import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getDb } from "../db.js";
import { requireAuth, AuthedRequest } from "../auth.js";

const router = Router();

const entrySchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  keywords: z.string().optional().default("")
});

const lorebookSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().default(""),
  entries: z.array(entrySchema).default([]),
  visibility: z.enum(["public", "private"]).default("private")
});

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const q = typeof req.query.q === "string" ? `%${req.query.q}%` : "%";
  const rows = await db.all(
    "SELECT * FROM lorebooks WHERE (visibility = 'public' OR owner_id = ?) AND (name LIKE ? OR description LIKE ?) ORDER BY updated_at DESC",
    req.user!.id,
    q,
    q
  );
  const lorebooks = rows.map((row: any) => ({
    ...row,
    entries: safeParseJson(row.entries)
  }));
  return res.json({ lorebooks });
});

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = lorebookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const id = nanoid();
  const data = parsed.data;
  const db = getDb();
  await db.run(
    "INSERT INTO lorebooks (id, owner_id, name, description, entries, visibility) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    req.user!.id,
    data.name,
    data.description || "",
    JSON.stringify(data.entries || []),
    data.visibility
  );
  const row = await db.get("SELECT * FROM lorebooks WHERE id = ?", id);
  return res.json({ lorebook: { ...row, entries: safeParseJson(row.entries) } });
});

router.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = lorebookSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const db = getDb();
  const existing = await db.get<{ owner_id: string }>("SELECT owner_id FROM lorebooks WHERE id = ?", req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.owner_id !== req.user!.id && req.user!.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const fields = parsed.data as any;
  const updates: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    updates.push(`${key} = ?`);
    if (key === "entries") values.push(JSON.stringify(value || []));
    else values.push(value);
  }
  if (updates.length === 0) return res.json({ ok: true });
  values.push(req.params.id);
  await db.run(`UPDATE lorebooks SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`, ...values);
  const row = await db.get("SELECT * FROM lorebooks WHERE id = ?", req.params.id);
  return res.json({ lorebook: { ...row, entries: safeParseJson(row.entries) } });
});

router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const db = getDb();
  const existing = await db.get<{ owner_id: string }>("SELECT owner_id FROM lorebooks WHERE id = ?", req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.owner_id !== req.user!.id && req.user!.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  await db.run("DELETE FROM lorebooks WHERE id = ?", req.params.id);
  return res.json({ ok: true });
});

function safeParseJson(raw: string) {
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

export default router;
