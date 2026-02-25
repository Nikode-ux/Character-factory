import { ChatProvider, ChatMessage, StreamChunk } from "./types.js";

const textDecoder = new TextDecoder();

async function* parseSseStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += textDecoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trimEnd();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      yield data;
    }
  }
}

export class OpenAICompatibleProvider implements ChatProvider {
  constructor(private baseUrl: string, private apiKey: string) {}

  async *generateChatCompletion(input: {
    messages: ChatMessage[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    stop?: string[];
    signal?: AbortSignal;
  }): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      signal: input.signal,
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 512,
        top_p: input.topP,
        presence_penalty: input.presencePenalty,
        frequency_penalty: input.frequencyPenalty,
        stop: input.stop && input.stop.length ? input.stop : undefined,
        stream: true
      })
    });

    if (!response.ok || !response.body) {
      const err = await response.text();
      throw new Error(`OpenAI-compatible error: ${response.status} ${err}`);
    }

    for await (const data of parseSseStream(response.body)) {
      if (data === "[DONE]") break;
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          yield { type: "token", token: delta };
        }
      } catch {
        continue;
      }
    }

    yield { type: "done" };
  }
}
