import { useEffect, useState } from "react";
import { getCharacters } from "../api";

export default function Discover() {
  const [query, setQuery] = useState("");
  const [characters, setCharacters] = useState<any[]>([]);

  const search = async () => {
    const res = await getCharacters(query);
    setCharacters(res.characters);
  };

  useEffect(() => {
    search().catch(() => {});
  }, []);

  return (
    <div className="grid">
      <div className="section-header">
        <h1 className="page-title">Discover</h1>
        <p>Find public characters and jump straight into a conversation.</p>
      </div>

      <div className="card discover-search">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, tags, style" />
        <button onClick={search}>Search</button>
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
                .slice(0, 6)
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
