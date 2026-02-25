import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getDb, getSetting } from "../db.js";
import { requireAuth, AuthedRequest } from "../auth.js";
import { buildPromptMessages } from "../services/chat.js";
import { getActiveProvider } from "../providers/index.js";

const router = Router();

const createChatSchema = z.object({
  character_id: z.string().min(1),
  title: z.string().min(1).optional()
});

const messageSchema = z.object({
  content: z.string().min(1).max(4000)
});

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const rows = await db.all(
    "SELECT c.*, ch.name as character_name FROM chats c JOIN characters ch ON c.character_id = ch.id WHERE c.user_id = ? ORDER BY c.updated_at DESC",
    req.user!.id
  );
  return res.json({ chats: rows });
});

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createChatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const db = getDb();
  const character = await db.get("SELECT id FROM characters WHERE id = ?", parsed.data.character_id);
  if (!character) return res.status(404).json({ error: "Character not found" });

  const id = nanoid();
  const title = parsed.data.title || "New chat";
  await db.run(
    "INSERT INTO chats (id, user_id, character_id, title) VALUES (?, ?, ?, ?)",
    id,
    req.user!.id,
    parsed.data.character_id,
    title
  );
  const chat = await db.get("SELECT * FROM chats WHERE id = ?", id);
  return res.json({ chat });
});

router.get("/:id/messages", requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const chat = await db.get("SELECT id FROM chats WHERE id = ? AND user_id = ?", req.params.id, req.user!.id);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  const rows = await db.all("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC", req.params.id);
  return res.json({ messages: rows });
});

router.post("/:id/messages", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const db = getDb();
  const chat = await db.get("SELECT id FROM chats WHERE id = ? AND user_id = ?", req.params.id, req.user!.id);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  const userMessageId = nanoid();
  await db.run(
    "INSERT INTO messages (id, chat_id, role, content) VALUES (?, ?, 'user', ?)",
    userMessageId,
    req.params.id,
    parsed.data.content
  );
  await db.run("UPDATE chats SET updated_at = datetime('now') WHERE id = ?", req.params.id);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const controller = new AbortController();
  let aborted = false;
  req.on("close", () => {
    aborted = true;
    controller.abort();
  });

  const startedAt = Date.now();
  let assistantText = "";
  try {
    const messages = await buildPromptMessages(req.params.id);
    const { provider, model, name } = await getActiveProvider();
    const temperature = Number((await getSetting("temperature")) || "0.7");
    const topP = Number((await getSetting("top_p")) || "1");
    const presencePenalty = Number((await getSetting("presence_penalty")) || "0");
    const frequencyPenalty = Number((await getSetting("frequency_penalty")) || "0");
    const stopRaw = (await getSetting("stop_sequences")) || "";
    const topK = Number((await getSetting("top_k")) || "40");
    const stop = stopRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const maxTokens = Number((await getSetting("max_tokens")) || "512");

    for await (const chunk of provider.generateChatCompletion({
      messages,
      model,
      temperature,
      maxTokens,
      topP,
      presencePenalty,
      frequencyPenalty,
      stop,
      topK,
      signal: controller.signal
    })) {
      if (chunk.type === "token") {
        assistantText += chunk.token;
        if (!aborted) {
          res.write(`event: token\n`);
          res.write(`data: ${JSON.stringify({ token: chunk.token })}\n\n`);
        }
      }
    }

    if (aborted) return;

    const assistantId = nanoid();
    await db.run(
      "INSERT INTO messages (id, chat_id, role, content) VALUES (?, ?, 'assistant', ?)",
      assistantId,
      req.params.id,
      assistantText
    );

    await db.run(
      "INSERT INTO usage_logs (id, user_id, provider, model, tokens_in, tokens_out, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
      nanoid(),
      req.user!.id,
      name,
      model,
      0,
      0,
      Date.now() - startedAt
    );

    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ ok: true })}\n\n`);
    res.end();
  } catch (err: any) {
    if (err?.name === "AbortError" || aborted) return;
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: err.message || "Provider error" })}\n\n`);
    res.end();
  }
});

router.post("/:id/messages/regenerate", requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const chat = await db.get("SELECT id FROM chats WHERE id = ? AND user_id = ?", req.params.id, req.user!.id);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  const lastUser = await db.get<{ id: string; created_at: string }>(
    "SELECT id, created_at FROM messages WHERE chat_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1",
    req.params.id
  );
  if (!lastUser) return res.status(400).json({ error: "No user message to regenerate" });

  const lastAssistant = await db.get<{ id: string }>(
    "SELECT id FROM messages WHERE chat_id = ? AND role = 'assistant' AND created_at > ? ORDER BY created_at DESC LIMIT 1",
    req.params.id,
    lastUser.created_at
  );
  if (lastAssistant) {
    await db.run("DELETE FROM messages WHERE id = ?", lastAssistant.id);
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const controller = new AbortController();
  let aborted = false;
  req.on("close", () => {
    aborted = true;
    controller.abort();
  });

  const startedAt = Date.now();
  let assistantText = "";
  try {
    const messages = await buildPromptMessages(req.params.id);
    const { provider, model, name } = await getActiveProvider();
    const temperature = Number((await getSetting("temperature")) || "0.7");
    const topP = Number((await getSetting("top_p")) || "1");
    const presencePenalty = Number((await getSetting("presence_penalty")) || "0");
    const frequencyPenalty = Number((await getSetting("frequency_penalty")) || "0");
    const stopRaw = (await getSetting("stop_sequences")) || "";
    const topK = Number((await getSetting("top_k")) || "40");
    const stop = stopRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const maxTokens = Number((await getSetting("max_tokens")) || "512");

    for await (const chunk of provider.generateChatCompletion({
      messages,
      model,
      temperature,
      maxTokens,
      topP,
      presencePenalty,
      frequencyPenalty,
      stop,
      topK,
      signal: controller.signal
    })) {
      if (chunk.type === "token") {
        assistantText += chunk.token;
        if (!aborted) {
          res.write(`event: token\n`);
          res.write(`data: ${JSON.stringify({ token: chunk.token })}\n\n`);
        }
      }
    }

    if (aborted) return;

    const assistantId = nanoid();
    await db.run(
      "INSERT INTO messages (id, chat_id, role, content) VALUES (?, ?, 'assistant', ?)",
      assistantId,
      req.params.id,
      assistantText
    );
    await db.run("UPDATE chats SET updated_at = datetime('now') WHERE id = ?", req.params.id);
    await db.run(
      "INSERT INTO usage_logs (id, user_id, provider, model, tokens_in, tokens_out, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
      nanoid(),
      req.user!.id,
      name,
      model,
      0,
      0,
      Date.now() - startedAt
    );

    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ ok: true })}\n\n`);
    res.end();
  } catch (err: any) {
    if (err?.name === "AbortError" || aborted) return;
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: err.message || "Provider error" })}\n\n`);
    res.end();
  }
});

export default router;
