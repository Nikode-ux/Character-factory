import { useEffect, useState } from "react";
import { getCharacters } from "../api";

export default function Home() {
  const [characters, setCharacters] = useState<any[]>([]);

  useEffect(() => {
    getCharacters()
      .then((res) => setCharacters(res.characters.slice(0, 6)))
      .catch(() => {});
  }, []);

  return (
    <div className="grid">
      <div className="hero">
        <div className="hero-copy">
          <div className="badge">Character.AI-style Workspace</div>
          <h1 className="page-title">Build characters and chat instantly.</h1>
          <p>
            Create personas, add lorebooks, and run long conversations with persistent memories. Everything here is now
            fixed dark mode with a clean chat-first layout.
          </p>
        </div>
        <div className="hero-card">
          <div className="mono">Quick start</div>
          <ul className="tip-list">
            <li>Open Chat and start a conversation with any character.</li>
            <li>Use Create to define tone, behavior, and constraints.</li>
            <li>Add lorebooks and memories to keep continuity.</li>
          </ul>
        </div>
      </div>

      <div className="section-header">
        <h2>Popular Characters</h2>
        <p>Top public profiles from your current database.</p>
      </div>

      <div className="grid grid-3">
        {characters.map((c) => (
          <div key={c.id} className="card character-card">
            <div className="badge">{c.visibility}</div>
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <div className="tag-row">
              {(c.tags || "")
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean)
                .slice(0, 4)
                .map((tag: string, idx: number) => (
                  <span key={idx} className="tag">
                    {tag}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
