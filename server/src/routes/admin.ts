import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin, AuthedRequest } from "../auth.js";
import { getSetting, setSetting } from "../db.js";

const router = Router();

const settingsSchema = z.object({
  active_provider: z.string().min(1),
  active_model: z.string().min(1),
  provider_configs: z.record(z.any()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  stop_sequences: z.string().optional(),
  max_tokens: z.number().min(64).max(4096).optional(),
  context_limit: z.number().min(10).max(200).optional(),
  memory_limit: z.number().min(0).max(50).optional(),
  lorebook_limit: z.number().min(0).max(50).optional(),
  global_system_prefix: z.string().optional(),
  top_k: z.number().min(1).max(100).optional(),
  safety_mode: z.enum(["standard", "relaxed", "strict"]).optional(),
  allow_registration: z.boolean().optional()
});

router.get("/settings", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const active_provider = await getSetting("active_provider");
  const active_model = await getSetting("active_model");
  const temperature = await getSetting("temperature");
  const top_p = await getSetting("top_p");
  const presence_penalty = await getSetting("presence_penalty");
  const frequency_penalty = await getSetting("frequency_penalty");
  const stop_sequences = await getSetting("stop_sequences");
  const max_tokens = await getSetting("max_tokens");
  const context_limit = await getSetting("context_limit");
  const memory_limit = await getSetting("memory_limit");
  const lorebook_limit = await getSetting("lorebook_limit");
  const global_system_prefix = await getSetting("global_system_prefix");
  const top_k = await getSetting("top_k");
  const safety_mode = await getSetting("safety_mode");
  const allow_registration = await getSetting("allow_registration");
  const provider_config_openai = await getSetting("provider_config_openai");
  const provider_config_gemini = await getSetting("provider_config_gemini");
  return res.json({
    active_provider,
    active_model,
    temperature: temperature ? Number(temperature) : 0.7,
    top_p: top_p ? Number(top_p) : 1,
    presence_penalty: presence_penalty ? Number(presence_penalty) : 0,
    frequency_penalty: frequency_penalty ? Number(frequency_penalty) : 0,
    stop_sequences: stop_sequences || "",
    max_tokens: max_tokens ? Number(max_tokens) : 512,
    context_limit: context_limit ? Number(context_limit) : 40,
    memory_limit: memory_limit ? Number(memory_limit) : 8,
    lorebook_limit: lorebook_limit ? Number(lorebook_limit) : 6,
    global_system_prefix: global_system_prefix || "",
    top_k: top_k ? Number(top_k) : 40,
    safety_mode: safety_mode || "standard",
    allow_registration: allow_registration ? allow_registration === "true" : true,
    provider_configs: {
      openai: provider_config_openai ? JSON.parse(provider_config_openai) : {},
      gemini: provider_config_gemini ? JSON.parse(provider_config_gemini) : {}
    }
  });
});

router.patch("/settings", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  await setSetting("active_provider", parsed.data.active_provider);
  await setSetting("active_model", parsed.data.active_model);
  if (typeof parsed.data.temperature === "number") {
    await setSetting("temperature", String(parsed.data.temperature));
  }
  if (typeof parsed.data.top_p === "number") {
    await setSetting("top_p", String(parsed.data.top_p));
  }
  if (typeof parsed.data.presence_penalty === "number") {
    await setSetting("presence_penalty", String(parsed.data.presence_penalty));
  }
  if (typeof parsed.data.frequency_penalty === "number") {
    await setSetting("frequency_penalty", String(parsed.data.frequency_penalty));
  }
  if (typeof parsed.data.stop_sequences === "string") {
    await setSetting("stop_sequences", parsed.data.stop_sequences);
  }
  if (typeof parsed.data.max_tokens === "number") {
    await setSetting("max_tokens", String(parsed.data.max_tokens));
  }
  if (typeof parsed.data.context_limit === "number") {
    await setSetting("context_limit", String(parsed.data.context_limit));
  }
  if (typeof parsed.data.memory_limit === "number") {
    await setSetting("memory_limit", String(parsed.data.memory_limit));
  }
  if (typeof parsed.data.lorebook_limit === "number") {
    await setSetting("lorebook_limit", String(parsed.data.lorebook_limit));
  }
  if (typeof parsed.data.global_system_prefix === "string") {
    await setSetting("global_system_prefix", parsed.data.global_system_prefix);
  }
  if (typeof parsed.data.top_k === "number") {
    await setSetting("top_k", String(parsed.data.top_k));
  }
  if (typeof parsed.data.safety_mode === "string") {
    await setSetting("safety_mode", parsed.data.safety_mode);
  }
  if (typeof parsed.data.allow_registration === "boolean") {
    await setSetting("allow_registration", parsed.data.allow_registration ? "true" : "false");
  }

  if (parsed.data.provider_configs?.openai) {
    await setSetting("provider_config_openai", JSON.stringify(parsed.data.provider_configs.openai));
  }
  if (parsed.data.provider_configs?.gemini) {
    await setSetting("provider_config_gemini", JSON.stringify(parsed.data.provider_configs.gemini));
  }

  return res.json({ ok: true });
});

router.get("/gemini/models", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const raw = (await getSetting("provider_config_gemini")) || "{}";
  const config = JSON.parse(raw);
  if (!config.apiKey) return res.status(400).json({ error: "Gemini API key is not configured" });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(config.apiKey)}`
    );
    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Gemini list models failed: ${response.status} ${err}` });
    }
    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models : [];
    const filtered = models
      .filter((m: any) =>
        Array.isArray(m.supportedGenerationMethods)
          ? m.supportedGenerationMethods.includes("generateContent") ||
            m.supportedGenerationMethods.includes("streamGenerateContent")
          : true
      )
      .map((m: any) => ({
        name: m.name,
        displayName: m.displayName,
        baseModelId: m.baseModelId,
        supportedGenerationMethods: m.supportedGenerationMethods || []
      }));
    return res.json({ models: filtered });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Gemini list models failed" });
  }
});

export default router;
