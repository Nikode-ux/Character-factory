import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export async function initDb() {
  if (db) return db;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const defaultDbPath = path.resolve(__dirname, "../data.db");
  const filename = process.env.DB_PATH || defaultDbPath;
  db = await open({ filename, driver: sqlite3.Database });
  await db.exec("PRAGMA foreign_keys = ON;");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      example_dialogue TEXT NOT NULL,
      tags TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'public',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lorebooks (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      entries TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      content TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 1,
      source_message_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );
  `);

  await ensureColumn("characters", "persona", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("characters", "greeting", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("characters", "scenario", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("characters", "traits", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("characters", "speaking_style", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("characters", "goals", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("characters", "knowledge", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("characters", "constraints", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("characters", "voice", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("characters", "lorebook_ids", "TEXT NOT NULL DEFAULT ''");

  await ensureSetting("active_provider", "openai");
  await ensureSetting("active_model", "gpt-3.5-turbo");
  await ensureSetting("temperature", "0.7");
  await ensureSetting("max_tokens", "512");
  await ensureSetting("context_limit", "40");
  await ensureSetting("memory_limit", "8");
  await ensureSetting("lorebook_limit", "6");
  await ensureSetting("global_system_prefix", "");
  await ensureSetting("provider_config_openai", JSON.stringify({ baseUrl: "https://api.openai.com", apiKey: "" }));
  await ensureSetting("provider_config_gemini", JSON.stringify({ apiKey: "", model: "gemini-1.5-flash" }));
  await ensureSetting("top_p", "1");
  await ensureSetting("presence_penalty", "0");
  await ensureSetting("frequency_penalty", "0");
  await ensureSetting("stop_sequences", "");
  await ensureSetting("top_k", "40");
  await ensureSetting("safety_mode", "standard");
  await ensureSetting("allow_registration", "true");

  await ensureAdminAccount();
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not initialized");
  return db;
}

async function ensureSetting(key: string, value: string) {
  const existing = await db!.get("SELECT key FROM settings WHERE key = ?", key);
  if (!existing) {
    await db!.run("INSERT INTO settings (key, value) VALUES (?, ?)", key, value);
  }
}

async function ensureColumn(table: string, column: string, definition: string) {
  const rows = await db!.all<{ name: string }[]>(`PRAGMA table_info(${table})`);
  const exists = rows.some((row) => row.name === column);
  if (!exists) {
    await db!.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function getSetting(key: string) {
  const row = await getDb().get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await getDb().run(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')",
    key,
    value
  );
}

async function ensureAdminAccount() {
  const adminEmail = process.env.ADMIN_EMAIL || "nikodemszczotka01@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Jagoda2011!";
  const existing = await db!.get("SELECT id FROM users WHERE email = ?", adminEmail);
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  if (existing) {
    await db!.run(
      "UPDATE users SET role = 'admin', password_hash = ? WHERE email = ?",
      passwordHash,
      adminEmail
    );
    return;
  }
  const id = nanoid();
  await db!.run(
    "INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
    id,
    adminEmail,
    passwordHash
  );
}
