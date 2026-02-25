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

function toGeminiPayload(messages: ChatMessage[]) {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  const contents = rest.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const payload: any = {
    contents
  };
  if (systemParts) {
    payload.systemInstruction = { parts: [{ text: systemParts }] };
  }
  return payload;
}

export class GeminiProvider implements ChatProvider {
  constructor(private apiKey: string) {}

  async *generateChatCompletion(input: {
    messages: ChatMessage[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<StreamChunk> {
    const modelName = input.model.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;
    const body = {
      ...toGeminiPayload(input.messages),
      generationConfig: {
        temperature: input.temperature ?? 0.7,
        maxOutputTokens: input.maxTokens ?? 512,
        topP: input.topP,
        topK: input.topK
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: input.signal,
      body: JSON.stringify(body)
    });

    if (!response.ok || !response.body) {
      const err = await response.text();
      throw new Error(`Gemini error: ${response.status} ${err}`);
    }

    for await (const data of parseSseStream(response.body)) {
      try {
        const json = JSON.parse(data);
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === "string" && text.length > 0) {
          yield { type: "token", token: text };
        }
      } catch {
        continue;
      }
    }

    yield { type: "done" };
  }
}
