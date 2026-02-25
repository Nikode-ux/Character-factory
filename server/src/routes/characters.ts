import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getDb } from "../db.js";
import { requireAuth, AuthedRequest } from "../auth.js";

const router = Router();

const characterSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(1),
  system_prompt: z.string().trim().min(1),
  example_dialogue: z.string().trim().min(1),
  tags: z.string().optional().default("").transform((v) => v.trim()),
  visibility: z.enum(["public", "private"]).default("public"),
  persona: z.string().optional().default("").transform((v) => v.trim()),
  greeting: z.string().optional().default("").transform((v) => v.trim()),
  scenario: z.string().optional().default("").transform((v) => v.trim()),
  traits: z.string().optional().default("").transform((v) => v.trim()),
  speaking_style: z.string().optional().default("").transform((v) => v.trim()),
  goals: z.string().optional().default("").transform((v) => v.trim()),
  knowledge: z.string().optional().default("").transform((v) => v.trim()),
  constraints: z.string().optional().default("").transform((v) => v.trim()),
  voice: z.string().optional().default("").transform((v) => v.trim()),
  lorebook_ids: z.string().optional().default("").transform((v) => v.trim())
});

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const q = typeof req.query.q === "string" ? `%${req.query.q}%` : "%";
  const rows = await db.all(
    "SELECT * FROM characters WHERE (visibility = 'public' OR owner_id = ?) AND (name LIKE ? OR description LIKE ?) ORDER BY created_at DESC",
    req.user!.id,
    q,
    q
  );
  return res.json({ characters: rows });
});

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = characterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      details: parsed.error.flatten()
    });
  }

  const id = nanoid();
  const data = parsed.data;
  const db = getDb();
  await db.run(
    "INSERT INTO characters (id, owner_id, name, description, system_prompt, example_dialogue, tags, visibility, persona, greeting, scenario, traits, speaking_style, goals, knowledge, constraints, voice, lorebook_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    req.user!.id,
    data.name,
    data.description,
    data.system_prompt,
    data.example_dialogue,
    data.tags,
    data.visibility,
    data.persona,
    data.greeting,
    data.scenario,
    data.traits,
    data.speaking_style,
    data.goals,
    data.knowledge,
    data.constraints,
    data.voice,
    data.lorebook_ids
  );
  const row = await db.get("SELECT * FROM characters WHERE id = ?", id);
  return res.json({ character: row });
});

router.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const row = await db.get(
    "SELECT * FROM characters WHERE id = ? AND (visibility = 'public' OR owner_id = ?)",
    req.params.id,
    req.user!.id
  );
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ character: row });
});

router.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = characterSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      details: parsed.error.flatten()
    });
  }

  const db = getDb();
  const existing = await db.get<{ owner_id: string }>("SELECT owner_id FROM characters WHERE id = ?", req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.owner_id !== req.user!.id && req.user!.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const fields = parsed.data;
  const updates: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    updates.push(`${key} = ?`);
    values.push(value);
  }
  if (updates.length === 0) return res.json({ ok: true });
  values.push(req.params.id);
  await db.run(
    `UPDATE characters SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`,
    ...values
  );
  const row = await db.get("SELECT * FROM characters WHERE id = ?", req.params.id);
  return res.json({ character: row });
});

router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const existing = await db.get<{ owner_id: string }>("SELECT owner_id FROM characters WHERE id = ?", req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.owner_id !== req.user!.id && req.user!.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  await db.run("DELETE FROM characters WHERE id = ?", req.params.id);
  return res.json({ ok: true });
});

export default router;
