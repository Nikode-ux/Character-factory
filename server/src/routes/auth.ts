import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { getDb } from "../db.js";
import { signToken, setAuthCookie, clearAuthCookie } from "../auth.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

router.post("/register", async (req, res) => {
  const allowRegistration = (await getDb().get("SELECT value FROM settings WHERE key = 'allow_registration'"))?.value;
  if (allowRegistration === "false") {
    return res.status(403).json({ error: "Registration disabled" });
  }
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const db = getDb();
  const { email, password } = parsed.data;
  const existing = await db.get("SELECT id FROM users WHERE email = ?", email);
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const role = "user";

  const passwordHash = await bcrypt.hash(password, 10);
  const id = nanoid();
  await db.run("INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)", id, email, passwordHash, role);

  const token = signToken({ id, email, role: role as "user" | "admin" });
  clearAuthCookie(res);
  setAuthCookie(res, token);
  return res.json({ id, email, role, token });
});

router.post("/login", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const db = getDb();
  const { email, password } = parsed.data;
  const user = await db.get<{ id: string; email: string; password_hash: string; role: "user" | "admin" }>(
    "SELECT id, email, password_hash, role FROM users WHERE email = ?",
    email
  );
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  clearAuthCookie(res);
  setAuthCookie(res, token);
  return res.json({ id: user.id, email: user.email, role: user.role, token });
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

export default router;
