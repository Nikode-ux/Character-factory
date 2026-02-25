import { useEffect, useState } from "react";
import { createLorebook, deleteLorebook, getLorebooks, updateLorebook, type Lorebook, type LorebookEntry } from "../api";

const emptyEntry: LorebookEntry = { title: "", content: "", keywords: "" };

export default function Lorebooks() {
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
  const [selected, setSelected] = useState<Lorebook | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    const res = await getLorebooks();
    setLorebooks(res.lorebooks || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const selectLorebook = (lb: Lorebook) => {
    setSelected({ ...lb, entries: lb.entries || [] });
    setStatus(null);
  };

  const createNew = () => {
    setSelected({
      id: "",
      name: "",
      description: "",
      visibility: "private",
      entries: [emptyEntry]
    });
  };

  const updateField = (key: keyof Lorebook, value: any) => {
    if (!selected) return;
    setSelected({ ...selected, [key]: value });
  };

  const updateEntry = (index: number, patch: Partial<LorebookEntry>) => {
    if (!selected) return;
    const entries = [...(selected.entries || [])];
    entries[index] = { ...entries[index], ...patch };
    setSelected({ ...selected, entries });
  };

  const addEntry = () => {
    if (!selected) return;
    setSelected({ ...selected, entries: [...(selected.entries || []), { ...emptyEntry }] });
  };

  const removeEntry = (index: number) => {
    if (!selected) return;
    const entries = [...(selected.entries || [])];
    entries.splice(index, 1);
    setSelected({ ...selected, entries });
  };

  const saveLorebook = async () => {
    if (!selected) return;
    try {
      setStatus(null);
      if (!selected.name.trim()) {
        setStatus("Name is required.");
        return;
      }
      if (selected.id) {
        const res = await updateLorebook(selected.id, selected);
        setSelected(res.lorebook);
      } else {
        const res = await createLorebook(selected);
        setSelected(res.lorebook);
      }
      await load();
      setStatus("Saved.");
    } catch (err: any) {
      setStatus(err.message || "Failed");
    }
  };

  const removeLorebook = async () => {
    if (!selected?.id) return;
    await deleteLorebook(selected.id);
    setSelected(null);
    await load();
  };

  return (
    <div className="grid">
      <h1 className="page-title">Lorebooks</h1>
      <div className="grid grid-2">
        <div className="card">
          <div className="grid">
            <button onClick={createNew}>New lorebook</button>
            <div className="list">
              {lorebooks.map((lb) => (
                <button key={lb.id} className="ghost-button" onClick={() => selectLorebook(lb)}>
                  {lb.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="card grid">
          {selected ? (
            <>
              <label>Name</label>
              <input value={selected.name} onChange={(e) => updateField("name", e.target.value)} />
              <label>Description</label>
              <textarea rows={2} value={selected.description} onChange={(e) => updateField("description", e.target.value)} />
              <label>Visibility</label>
              <select value={selected.visibility} onChange={(e) => updateField("visibility", e.target.value)}>
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>

              <h3>Entries</h3>
              <div className="grid">
                {(selected.entries || []).map((entry, index) => (
                  <div key={index} className="card grid">
                    <label>Title</label>
                    <input value={entry.title} onChange={(e) => updateEntry(index, { title: e.target.value })} />
                    <label>Keywords (comma separated)</label>
                    <input value={entry.keywords || ""} onChange={(e) => updateEntry(index, { keywords: e.target.value })} />
                    <label>Content</label>
                    <textarea rows={3} value={entry.content} onChange={(e) => updateEntry(index, { content: e.target.value })} />
                    <button className="ghost-button" onClick={() => removeEntry(index)}>
                      Remove entry
                    </button>
                  </div>
                ))}
                <button className="ghost-button" onClick={addEntry}>Add entry</button>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button onClick={saveLorebook}>Save lorebook</button>
                {selected.id && (
                  <button className="ghost-button" onClick={removeLorebook}>
                    Delete lorebook
                  </button>
                )}
              </div>
              {status && <div style={{ color: "var(--muted)" }}>{status}</div>}
            </>
          ) : (
            <div style={{ color: "var(--muted)" }}>Select or create a lorebook.</div>
          )}
        </div>
      </div>
    </div>
  );
}
