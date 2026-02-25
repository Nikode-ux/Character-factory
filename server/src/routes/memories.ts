import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getDb } from "../db.js";
import { requireAuth, AuthedRequest } from "../auth.js";

const router = Router();

const memorySchema = z.object({
  character_id: z.string().min(1),
  content: z.string().min(1),
  importance: z.number().int().min(1).max(5).default(1)
});

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const characterId = typeof req.query.character_id === "string" ? req.query.character_id : "";
  if (!characterId) return res.status(400).json({ error: "character_id is required" });

  const db = getDb();
  const rows = await db.all(
    "SELECT * FROM memories WHERE user_id = ? AND character_id = ? ORDER BY importance DESC, created_at DESC",
    req.user!.id,
    characterId
  );
  return res.json({ memories: rows });
});

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = memorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const id = nanoid();
  const data = parsed.data;
  const db = getDb();
  const character = await db.get("SELECT id FROM characters WHERE id = ?", data.character_id);
  if (!character) return res.status(404).json({ error: "Character not found" });

  await db.run(
    "INSERT INTO memories (id, user_id, character_id, content, importance) VALUES (?, ?, ?, ?, ?)",
    id,
    req.user!.id,
    data.character_id,
    data.content,
    data.importance
  );
  const row = await db.get("SELECT * FROM memories WHERE id = ?", id);
  return res.json({ memory: row });
});

router.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = memorySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const db = getDb();
  const existing = await db.get<{ user_id: string }>("SELECT user_id FROM memories WHERE id = ?", req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.user_id !== req.user!.id && req.user!.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const fields = parsed.data as any;
  const updates: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    updates.push(`${key} = ?`);
    values.push(value);
  }
  if (updates.length === 0) return res.json({ ok: true });
  values.push(req.params.id);
  await db.run(`UPDATE memories SET ${updates.join(", ")} WHERE id = ?`, ...values);
  const row = await db.get("SELECT * FROM memories WHERE id = ?", req.params.id);
  return res.json({ memory: row });
});

router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const existing = await db.get<{ user_id: string }>("SELECT user_id FROM memories WHERE id = ?", req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.user_id !== req.user!.id && req.user!.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  await db.run("DELETE FROM memories WHERE id = ?", req.params.id);
  return res.json({ ok: true });
});

export default router;
