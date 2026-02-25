export type User = { id: string; email: string; role: "user" | "admin" };
type AuthResponse = User & { token?: string };
export type Character = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  example_dialogue: string;
  tags: string;
  visibility: "public" | "private";
  owner_id: string;
  persona?: string;
  greeting?: string;
  scenario?: string;
  traits?: string;
  speaking_style?: string;
  goals?: string;
  knowledge?: string;
  constraints?: string;
  voice?: string;
  lorebook_ids?: string;
};

export type LorebookEntry = { title: string; content: string; keywords?: string };
export type Lorebook = {
  id: string;
  name: string;
  description: string;
  entries: LorebookEntry[];
  visibility: "public" | "private";
};

export type MemoryItem = {
  id: string;
  character_id: string;
  content: string;
  importance: number;
  created_at: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

let authToken: string | null = localStorage.getItem("pf_token");

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem("pf_token", token);
  else localStorage.removeItem("pf_token");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers ? (options.headers as Record<string, string>) : {})
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    if (err?.details?.fieldErrors) {
      const messages: string[] = [];
      for (const [key, value] of Object.entries(err.details.fieldErrors)) {
        if (Array.isArray(value) && value.length > 0) {
          messages.push(`${key}: ${value.join(", ")}`);
        }
      }
      if (messages.length > 0) {
        throw new Error(`${err.error || "Invalid input"} (${messages.join(" | ")})`);
      }
    }
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export async function register(email: string, password: string) {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

export async function login(email: string, password: string) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

export async function logout() {
  setAuthToken(null);
  return apiFetch("/auth/logout", { method: "POST" });
}

export async function getMe() {
  return apiFetch<{ user: User }>("/me");
}

export async function getCharacters(q = "") {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<{ characters: Character[] }>(`/characters${query}`);
}

export async function createCharacter(payload: Partial<Character>) {
  return apiFetch("/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function updateCharacter(id: string, payload: Partial<Character>) {
  return apiFetch(`/characters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function getChats() {
  return apiFetch("/chats");
}

export async function createChat(character_id: string) {
  return apiFetch("/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ character_id })
  });
}

export async function getMessages(chatId: string) {
  return apiFetch(`/chats/${chatId}/messages`);
}

export async function sendMessageStream(
  chatId: string,
  content: string,
  onToken: (token: string) => void,
  onDone: () => void,
  signal?: AbortSignal
) {
  const res = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content }),
    signal
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trimEnd();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      let payload: any;
      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }
      if (payload.error) {
        throw new Error(payload.error);
      }
      if (payload.token) onToken(payload.token);
    }
  }

  onDone();
}

export async function regenerateMessageStream(
  chatId: string,
  onToken: (token: string) => void,
  onDone: () => void,
  signal?: AbortSignal
) {
  const res = await fetch(`${API_BASE}/chats/${chatId}/messages/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    signal
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trimEnd();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      let payload: any;
      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }
      if (payload.error) {
        throw new Error(payload.error);
      }
      if (payload.token) onToken(payload.token);
    }
  }

  onDone();
}

export async function getAdminSettings() {
  return apiFetch("/admin/settings");
}

export async function updateAdminSettings(payload: any) {
  return apiFetch("/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function getGeminiModels() {
  return apiFetch("/admin/gemini/models");
}

export async function getLorebooks(q = "") {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<{ lorebooks: Lorebook[] }>(`/lorebooks${query}`);
}

export async function createLorebook(payload: Partial<Lorebook>) {
  return apiFetch("/lorebooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function updateLorebook(id: string, payload: Partial<Lorebook>) {
  return apiFetch(`/lorebooks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteLorebook(id: string) {
  return apiFetch(`/lorebooks/${id}`, { method: "DELETE" });
}

export async function getMemories(characterId: string) {
  const query = `?character_id=${encodeURIComponent(characterId)}`;
  return apiFetch<{ memories: MemoryItem[] }>(`/memories${query}`);
}

export async function createMemory(payload: { character_id: string; content: string; importance?: number }) {
  return apiFetch(`/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteMemory(id: string) {
  return apiFetch(`/memories/${id}`, { method: "DELETE" });
}
