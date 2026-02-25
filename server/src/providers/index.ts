import { getSetting } from "../db.js";
import { GeminiProvider } from "./gemini.js";
import { OpenAICompatibleProvider } from "./openaiCompatible.js";
import type { ChatProvider } from "./types.js";

export async function getActiveProvider(): Promise<{ provider: ChatProvider; name: string; model: string }> {
  const activeProvider = (await getSetting("active_provider")) || "openai";
  const activeModel = (await getSetting("active_model")) || "gpt-3.5-turbo";

  if (activeProvider === "gemini") {
    const raw = (await getSetting("provider_config_gemini")) || "{}";
    const config = JSON.parse(raw);
    if (!config.apiKey) throw new Error("Gemini API key is not configured");
    const normalized = activeModel ? activeModel.replace(/^models\//, "") : "";
    const model = normalized.startsWith("gemini") ? normalized : config.model || "gemini-1.5-flash";
    return { provider: new GeminiProvider(config.apiKey), name: "gemini", model };
  }

  const raw = (await getSetting("provider_config_openai")) || "{}";
  const config = JSON.parse(raw);
  if (!config.apiKey) throw new Error("OpenAI-compatible API key is not configured");
  const baseUrl = config.baseUrl || "https://api.openai.com";
  return { provider: new OpenAICompatibleProvider(baseUrl, config.apiKey), name: "openai", model: activeModel };
}
