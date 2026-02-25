import { useEffect, useState } from "react";
import { getCharacters } from "../api";

export default function Profile() {
  const [characters, setCharacters] = useState<any[]>([]);

  useEffect(() => {
    getCharacters()
      .then((res) => setCharacters(res.characters))
      .catch(() => {});
  }, []);

  return (
    <div className="grid">
      <div className="section-header">
        <h1 className="page-title">Profile</h1>
        <p>Overview of your available characters in this workspace.</p>
      </div>

      <div className="grid grid-3">
        <div className="card stat-card">
          <div className="mono">Characters</div>
          <strong>{characters.length}</strong>
        </div>
      </div>

      <div className="card">
        <h3>My Characters</h3>
        <div className="list">
          {characters.map((c) => (
            <div key={c.id} className="card">
              <strong>{c.name}</strong>
              <div>{c.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
