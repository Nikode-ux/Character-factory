import { useEffect, useRef, useState } from "react";
import {
  createChat,
  createMemory,
  deleteMemory,
  getCharacters,
  getChats,
  getMemories,
  getMessages,
  regenerateMessageStream,
  sendMessageStream
} from "../api";
import { loadSettings } from "../uiSettings";

export default function Chat({ userId }: { userId: string }) {
  const [characters, setCharacters] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(loadSettings().showTimestamps);
  const [showTypingIndicator, setShowTypingIndicator] = useState(loadSettings().showTypingIndicator);
  const [error, setError] = useState<string | null>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [memoryInput, setMemoryInput] = useState("");
  const [memoryImportance, setMemoryImportance] = useState(2);
  const [newCharacterId, setNewCharacterId] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setCharacters([]);
    setChats([]);
    setSelectedChat(null);
    setMessages([]);
    setMemories([]);
    getCharacters()
      .then((res) => setCharacters(res.characters))
      .catch(() => setCharacters([]));
    getChats()
      .then((res) => setChats(res.chats))
      .catch(() => setChats([]));
  }, [userId]);

  useEffect(() => {
    const sync = () => {
      const s = loadSettings();
      setShowTimestamps(s.showTimestamps);
      setShowTypingIndicator(s.showTypingIndicator);
    };
    window.addEventListener("pf-settings", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pf-settings", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const loadMessages = async (chatId: string) => {
    const res = await getMessages(chatId);
    setMessages(res.messages);
  };

  const loadMemories = async (chat: any) => {
    if (!chat?.character_id) return;
    const res = await getMemories(chat.character_id);
    setMemories(res.memories || []);
  };

  const startChat = async (characterId: string) => {
    if (!characterId) return;
    const res = await createChat(characterId);
    setChats((prev) => [res.chat, ...prev]);
    setSelectedChat(res.chat);
    setMessages([]);
    setNewCharacterId("");
    await loadMemories(res.chat);
  };

  const openChat = async (chat: any) => {
    if (!chat) return;
    setSelectedChat(chat);
    await loadMessages(chat.id);
    await loadMemories(chat);
  };

  const copyMessage = async (content: string) => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // ignore clipboard errors
    }
  };

  const addMemory = async (content: string) => {
    if (!selectedChat?.character_id || !content.trim()) return;
    await createMemory({
      character_id: selectedChat.character_id,
      content: content.trim(),
      importance: memoryImportance
    });
    setMemoryInput("");
    await loadMemories(selectedChat);
  };

  const removeMemory = async (id: string) => {
    await deleteMemory(id);
    await loadMemories(selectedChat);
  };

  const send = async () => {
    if (!selectedChat || !input.trim()) return;
    setError(null);
    const userMsg = { role: "user", content: input.trim(), id: Math.random().toString(36) };
    const assistantId = Math.random().toString(36);
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "", id: assistantId, streaming: true }]);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setLoading(true);

    let buffer = "";
    const controller = new AbortController();
    abortRef.current = controller;
    streamingIdRef.current = assistantId;

    await sendMessageStream(
      selectedChat.id,
      userMsg.content,
      (token) => {
        buffer += token;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: buffer } : m)));
      },
      () => {
        setLoading(false);
        streamingIdRef.current = null;
        abortRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)));
        getChats()
          .then((res) => setChats(res.chats))
          .catch(() => {});
      },
      controller.signal
    ).catch((err) => {
      setLoading(false);
      streamingIdRef.current = null;
      abortRef.current = null;
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      setError(err?.message || "Failed to generate response.");
    });
  };

  const renderInline = (text: string, keyBase: string) => {
    const parts = text.split(/(".*?")/g);
    return parts.map((part, idx) => {
      if (part.startsWith("\"") && part.endsWith("\"") && part.length >= 2) {
        return (
          <span key={`${keyBase}-q-${idx}`} className="rp-quote">
            {part}
          </span>
        );
      }
      return <span key={`${keyBase}-t-${idx}`}>{part}</span>;
    });
  };

  const renderFormatted = (text: string) => {
    const tokens: { type: "text" | "strong" | "em" | "code"; value: string }[] = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      const index = match.index ?? 0;
      if (index > lastIndex) {
        tokens.push({ type: "text", value: text.slice(lastIndex, index) });
      }
      const token = match[0];
      if (token.startsWith("**")) {
        tokens.push({ type: "strong", value: token.slice(2, -2) });
      } else if (token.startsWith("*")) {
        tokens.push({ type: "em", value: token.slice(1, -1) });
      } else if (token.startsWith("`")) {
        tokens.push({ type: "code", value: token.slice(1, -1) });
      }
      lastIndex = index + token.length;
    }
    if (lastIndex < text.length) {
      tokens.push({ type: "text", value: text.slice(lastIndex) });
    }

    return tokens.map((token, idx) => {
      const keyBase = `seg-${idx}`;
      if (token.type === "strong") {
        return (
          <strong key={keyBase} className="rp-strong">
            {token.value}
          </strong>
        );
      }
      if (token.type === "em") {
        return (
          <em key={keyBase} className="rp-action">
            {token.value}
          </em>
        );
      }
      if (token.type === "code") {
        return (
          <code key={keyBase} className="rp-code">
            {token.value}
          </code>
        );
      }
      return <span key={keyBase}>{renderInline(token.value, keyBase)}</span>;
    });
  };

  const renderMessage = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => (
      <span key={`line-${idx}`}>
        {renderFormatted(line)}
        {idx < lines.length - 1 ? <br /> : null}
      </span>
    ));
  };

  const stopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (streamingIdRef.current) {
      const id = streamingIdRef.current;
      streamingIdRef.current = null;
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
    setLoading(false);
  };

  const regenerate = async () => {
    if (!selectedChat || loading) return;
    setError(null);
    const lastAssistantIndex = [...messages].reverse().findIndex((m) => m.role === "assistant");
    if (lastAssistantIndex === -1) return;
    const absoluteIndex = messages.length - 1 - lastAssistantIndex;

    const assistantId = Math.random().toString(36);
    setMessages((prev) => {
      const copy = [...prev];
      copy.splice(absoluteIndex, 1);
      copy.push({ role: "assistant", content: "", id: assistantId, streaming: true });
      return copy;
    });
    setLoading(true);

    let buffer = "";
    const controller = new AbortController();
    abortRef.current = controller;
    streamingIdRef.current = assistantId;

    await regenerateMessageStream(
      selectedChat.id,
      (token) => {
        buffer += token;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: buffer } : m)));
      },
      () => {
        setLoading(false);
        streamingIdRef.current = null;
        abortRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)));
      },
      controller.signal
    ).catch((err) => {
      setLoading(false);
      streamingIdRef.current = null;
      abortRef.current = null;
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      setError(err?.message || "Failed to regenerate response.");
    });
  };

  return (
    <div className="grid">
      <div className="section-header">
        <h1 className="page-title">Chat</h1>
        <p>Choose a character, open a thread, and keep memory continuity.</p>
      </div>

      <div className="chat-layout">
        <section className="card chat-side-left">
          <h3>Start New Chat</h3>
          <div className="grid">
            <select value={newCharacterId} onChange={(e) => setNewCharacterId(e.target.value)}>
              <option value="">Pick a character...</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button onClick={() => startChat(newCharacterId)} disabled={!newCharacterId}>
              Start conversation
            </button>
          </div>

          <h3>Recent Threads</h3>
          <div className="list">
            {chats.map((c) => (
              <button
                key={c.id}
                className={`ghost-button ${selectedChat?.id === c.id ? "active" : ""}`}
                onClick={() => openChat(c)}
              >
                {c.title}
              </button>
            ))}
          </div>
        </section>

        <section className="card chat-main-panel">
          <div className="chat-messages">
            {messages.length === 0 && !error && (
              <div className="empty-state">No messages yet. Start a chat and send your first message.</div>
            )}

            {messages.map((m, idx) => (
              <div key={m.id || `msg-${idx}`} className={`message ${m.role} ${m.streaming ? "typing" : ""}`}>
                <div className="mono">
                  {m.role}
                  {showTimestamps && m.created_at ? ` · ${new Date(m.created_at).toLocaleTimeString()}` : ""}
                </div>
                <div className="message-content">{renderMessage(m.content)}</div>
                {m.streaming && showTypingIndicator && (
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                {!m.streaming && (
                  <div className="message-actions">
                    {m.role === "assistant" && (
                      <button className="ghost-button" onClick={() => copyMessage(m.content)}>
                        Copy
                      </button>
                    )}
                    {selectedChat?.character_id && (
                      <button className="ghost-button" onClick={() => addMemory(m.content)}>
                        Remember
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {error && (
              <div className="message assistant">
                <div className="mono">error</div>
                <div>{error}</div>
              </div>
            )}
          </div>

          <div className="composer">
            <textarea
              rows={2}
              value={input}
              ref={inputRef}
              onChange={(e) => setInput(e.target.value)}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 200) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (!loading) send();
                }
              }}
              placeholder={selectedChat ? "Write your message..." : "Start or open a chat first"}
              disabled={!selectedChat}
            />
            <div className="composer-actions">
              <button onClick={send} disabled={loading || !selectedChat || !input.trim()}>
                {loading ? "Thinking..." : "Send"}
              </button>
              <button className="ghost-button" onClick={regenerate} disabled={!selectedChat || loading || messages.length === 0}>
                Regenerate
              </button>
              <button className="ghost-button" onClick={stopGeneration} disabled={!loading}>
                Stop
              </button>
            </div>
          </div>
        </section>

        <section className="card chat-side-right">
          <h3>Context</h3>
          <p>All chats and memories are stored on your backend database.</p>

          {selectedChat && (
            <div className="card nested-card">
              <div className="badge">Active chat</div>
              <div className="active-chat-title">{selectedChat.title}</div>
            </div>
          )}

          <div className="card nested-card">
            <div className="badge">Memory</div>
            <div className="grid">
              <textarea
                rows={2}
                placeholder="Add a memory..."
                value={memoryInput}
                onChange={(e) => setMemoryInput(e.target.value)}
              />
              <select value={memoryImportance} onChange={(e) => setMemoryImportance(Number(e.target.value))}>
                <option value={1}>Importance 1</option>
                <option value={2}>Importance 2</option>
                <option value={3}>Importance 3</option>
                <option value={4}>Importance 4</option>
                <option value={5}>Importance 5</option>
              </select>
              <button className="ghost-button" onClick={() => addMemory(memoryInput)} disabled={!selectedChat?.character_id}>
                Save memory
              </button>

              <div className="list">
                {memories.map((mem) => (
                  <div key={mem.id} className="card nested-card">
                    <div className="mono">Importance {mem.importance}</div>
                    <div>{mem.content}</div>
                    <button className="ghost-button" onClick={() => removeMemory(mem.id)}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="badge">Streaming enabled</div>
        </section>
      </div>
    </div>
  );
}
