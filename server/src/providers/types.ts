export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderConfig = {
  name: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
};

export type StreamChunk = { type: "token"; token: string } | { type: "done" };

export interface ChatProvider {
  generateChatCompletion(input: {
    messages: ChatMessage[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    stop?: string[];
    topK?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<StreamChunk>;
}
