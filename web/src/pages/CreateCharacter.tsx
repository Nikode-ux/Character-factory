import { useEffect, useState } from "react";
import { createCharacter, getLorebooks, type Lorebook } from "../api";

export default function CreateCharacter() {
  const [form, setForm] = useState({
    name: "",
    description: "",
    system_prompt: "",
    example_dialogue: "",
    tags: "",
    visibility: "public",
    persona: "",
    greeting: "",
    scenario: "",
    traits: "",
    speaking_style: "",
    goals: "",
    knowledge: "",
    constraints: "",
    voice: "",
    lorebook_ids: ""
  });
  const [status, setStatus] = useState<string | null>(null);
  const [lorebooks, setLorebooks] = useState<Lorebook[]>([]);
  const [selectedLorebooks, setSelectedLorebooks] = useState<string[]>([]);

  useEffect(() => {
    getLorebooks().then((res) => setLorebooks(res.lorebooks || [])).catch(() => {});
  }, []);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleLorebook = (id: string) => {
    setSelectedLorebooks((prev) => {
      const next = prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id];
      setForm((f) => ({ ...f, lorebook_ids: next.join(",") }));
      return next;
    });
  };

  const submit = async () => {
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        system_prompt: form.system_prompt.trim(),
        example_dialogue: form.example_dialogue.trim(),
        tags: form.tags.trim()
      };
      if (payload.name.length < 2) {
        setStatus("Name must be at least 2 characters.");
        return;
      }
      if (!payload.description || !payload.system_prompt || !payload.example_dialogue) {
        setStatus("Please fill in description, system prompt, and example dialogue.");
        return;
      }
      await createCharacter(payload);
      setStatus("Character created.");
      setForm({
        name: "",
        description: "",
        system_prompt: "",
        example_dialogue: "",
        tags: "",
        visibility: "public",
        persona: "",
        greeting: "",
        scenario: "",
        traits: "",
        speaking_style: "",
        goals: "",
        knowledge: "",
        constraints: "",
        voice: "",
        lorebook_ids: ""
      });
      setSelectedLorebooks([]);
    } catch (err: any) {
      setStatus(err.message || "Failed");
    }
  };

  return (
    <div className="grid">
      <h1 className="page-title">Create Character</h1>
      <div className="grid grid-2">
        <div className="card grid">
          <h3>Core</h3>
          <input placeholder="Name" value={form.name} onChange={(e) => update("name", e.target.value)} />
          <textarea
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
          <textarea
            rows={4}
            placeholder="System prompt"
            value={form.system_prompt}
            onChange={(e) => update("system_prompt", e.target.value)}
          />
          <textarea
            rows={4}
            placeholder="Example dialogue"
            value={form.example_dialogue}
            onChange={(e) => update("example_dialogue", e.target.value)}
          />
          <input placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => update("tags", e.target.value)} />
          <select value={form.visibility} onChange={(e) => update("visibility", e.target.value)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="card grid">
          <h3>Persona</h3>
          <textarea rows={3} placeholder="Persona summary" value={form.persona} onChange={(e) => update("persona", e.target.value)} />
          <textarea rows={2} placeholder="Greeting" value={form.greeting} onChange={(e) => update("greeting", e.target.value)} />
          <textarea rows={2} placeholder="Scenario" value={form.scenario} onChange={(e) => update("scenario", e.target.value)} />
          <textarea rows={2} placeholder="Traits" value={form.traits} onChange={(e) => update("traits", e.target.value)} />
          <textarea rows={2} placeholder="Speaking style" value={form.speaking_style} onChange={(e) => update("speaking_style", e.target.value)} />
          <textarea rows={2} placeholder="Goals" value={form.goals} onChange={(e) => update("goals", e.target.value)} />
          <textarea rows={2} placeholder="Knowledge" value={form.knowledge} onChange={(e) => update("knowledge", e.target.value)} />
          <textarea rows={2} placeholder="Constraints" value={form.constraints} onChange={(e) => update("constraints", e.target.value)} />
          <textarea rows={2} placeholder="Voice" value={form.voice} onChange={(e) => update("voice", e.target.value)} />
        </div>
      </div>

      <div className="card grid">
        <h3>Lorebooks</h3>
        {lorebooks.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>No lorebooks yet. Create one in the Lorebooks page.</div>
        ) : (
          <div className="list">
            {lorebooks.map((lb) => (
              <label key={lb.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={selectedLorebooks.includes(lb.id)} onChange={() => toggleLorebook(lb.id)} />
                <span>{lb.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={submit}>Save Character</button>
        {status && <div style={{ color: "var(--muted)" }}>{status}</div>}
      </div>
    </div>
  );
}
