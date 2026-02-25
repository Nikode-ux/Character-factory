import { getDb, getSetting } from "../db.js";
import type { ChatMessage } from "../providers/types.js";

export async function buildPromptMessages(chatId: string) {
  const db = getDb();
  const chat = await db.get<{ character_id: string; user_id: string }>(
    "SELECT character_id, user_id FROM chats WHERE id = ?",
    chatId
  );
  if (!chat) throw new Error("Chat not found");

  const character = await db.get<{
    name: string;
    description: string;
    system_prompt: string;
    example_dialogue: string;
    persona: string;
    greeting: string;
    scenario: string;
    traits: string;
    speaking_style: string;
    goals: string;
    knowledge: string;
    constraints: string;
    voice: string;
    lorebook_ids: string;
  }>(
    "SELECT name, description, system_prompt, example_dialogue, persona, greeting, scenario, traits, speaking_style, goals, knowledge, constraints, voice, lorebook_ids FROM characters WHERE id = ?",
    chat.character_id
  );
  if (!character) throw new Error("Character not found");

  const globalPrefix = (await getSetting("global_system_prefix")) || "";

  const rawLimit = await getSetting("context_limit");
  const limit = Math.max(10, Math.min(200, Number(rawLimit || "40")));
  // Fetch the most recent messages, then restore chronological order.
  const rowsDesc = await db.all<{ role: string; content: string }[]>(
    "SELECT role, content FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?",
    chatId,
    limit
  );
  const rows = rowsDesc.reverse();

  const lastUserMessage = [...rows].reverse().find((row) => row.role === "user")?.content || "";
  const tokens = extractKeywords(lastUserMessage);

  const sections: string[] = [];
  if (globalPrefix) sections.push(globalPrefix);
  sections.push(`You are roleplaying as: ${character.name}.`);
  if (character.description) sections.push(character.description);

  const personaLines = buildPersonaLines(character);
  if (personaLines.length > 0) {
    sections.push(`Character details:\n- ${personaLines.join("\n- ")}`);
  }

  const memorySection = await buildMemorySection(db, chat.user_id, chat.character_id, tokens);
  if (memorySection) sections.push(memorySection);

  const lorebookSection = await buildLorebookSection(db, character.lorebook_ids, tokens);
  if (lorebookSection) sections.push(lorebookSection);

  if (character.system_prompt) sections.push(`Guidelines:\n${character.system_prompt}`);
  if (character.example_dialogue) sections.push(`Example dialogue:\n${character.example_dialogue}`);

  const systemPrompt = sections.join("\n\n");

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];
  for (const row of rows) {
    if (row.role === "assistant") messages.push({ role: "assistant", content: row.content });
    if (row.role === "user") messages.push({ role: "user", content: row.content });
  }

  return messages;
}

function buildPersonaLines(character: {
  persona: string;
  greeting: string;
  scenario: string;
  traits: string;
  speaking_style: string;
  goals: string;
  knowledge: string;
  constraints: string;
  voice: string;
}) {
  const lines: string[] = [];
  if (character.persona) lines.push(`Persona: ${character.persona}`);
  if (character.scenario) lines.push(`Scenario: ${character.scenario}`);
  if (character.traits) lines.push(`Traits: ${character.traits}`);
  if (character.speaking_style) lines.push(`Speaking style: ${character.speaking_style}`);
  if (character.goals) lines.push(`Goals: ${character.goals}`);
  if (character.knowledge) lines.push(`Knowledge: ${character.knowledge}`);
  if (character.constraints) lines.push(`Constraints: ${character.constraints}`);
  if (character.voice) lines.push(`Voice: ${character.voice}`);
  if (character.greeting) lines.push(`Greeting: ${character.greeting}`);
  return lines;
}

async function buildMemorySection(
  db: any,
  userId: string,
  characterId: string,
  tokens: string[]
) {
  type MemoryRow = {
    id: string;
    content: string;
    importance: number;
  };
  const rawLimit = await getSetting("memory_limit");
  const limit = Math.max(0, Math.min(50, Number(rawLimit || "8")));
  if (limit === 0) return "";

  const memories: MemoryRow[] = await db.all(
    "SELECT id, content, importance FROM memories WHERE user_id = ? AND character_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?",
    userId,
    characterId,
    limit * 3
  );

  if (!memories.length) return "";

  const matching = tokens.length
    ? memories.filter((mem) => containsToken(mem.content, tokens))
    : memories;
  const selected = (matching.length ? matching : memories).slice(0, limit);
  if (!selected.length) return "";

  const ids = selected.map((m) => m.id);
  await db.run(
    `UPDATE memories SET last_used = datetime('now') WHERE id IN (${ids.map(() => "?").join(",")})`,
    ...ids
  );

  return `Memory snippets:\n- ${selected.map((m) => m.content).join("\n- ")}`;
}

async function buildLorebookSection(db: any, lorebookIdsRaw: string, tokens: string[]) {
  const rawLimit = await getSetting("lorebook_limit");
  const limit = Math.max(0, Math.min(50, Number(rawLimit || "6")));
  if (limit === 0) return "";

  const ids = lorebookIdsRaw
    ? lorebookIdsRaw.split(",").map((id) => id.trim()).filter(Boolean)
    : [];
  if (!ids.length) return "";

  const rows = await db.all(
    `SELECT id, name, entries FROM lorebooks WHERE id IN (${ids.map(() => "?").join(",")})`,
    ...ids
  );

  const entries: { lorebook: string; title: string; content: string; keywords: string }[] = [];
  for (const row of rows) {
    const parsed = safeParseJson(row.entries);
    for (const entry of parsed) {
      entries.push({
        lorebook: row.name,
        title: entry.title || "",
        content: entry.content || "",
        keywords: entry.keywords || ""
      });
    }
  }

  if (!entries.length) return "";

  const filtered = entries.filter((entry) => {
    const keys = entry.keywords
      .split(/[,\n]/)
      .map((k: string) => k.trim().toLowerCase())
      .filter(Boolean);
    if (keys.length === 0) return true;
    if (tokens.length === 0) return false;
    return keys.some((k) => tokens.some((t) => t.includes(k) || k.includes(t)));
  });

  const selected = (filtered.length ? filtered : entries).slice(0, limit);
  if (!selected.length) return "";

  return `Lorebook:\n- ${selected
    .map((entry) => `[${entry.lorebook}] ${entry.title ? entry.title + ": " : ""}${entry.content}`)
    .join("\n- ")}`;
}

function extractKeywords(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4)
    .slice(0, 12);
}

function containsToken(text: string, tokens: string[]) {
  const lower = text.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

function safeParseJson(raw: string) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
