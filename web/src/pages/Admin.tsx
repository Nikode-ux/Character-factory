import { useEffect, useState } from "react";
import { getAdminSettings, getGeminiModels, updateAdminSettings } from "../api";

export default function Admin() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-3.5-turbo");
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [stopSequences, setStopSequences] = useState("");
  const [maxTokens, setMaxTokens] = useState(512);
  const [contextLimit, setContextLimit] = useState(40);
  const [memoryLimit, setMemoryLimit] = useState(8);
  const [lorebookLimit, setLorebookLimit] = useState(6);
  const [globalPrefix, setGlobalPrefix] = useState("");
  const [topK, setTopK] = useState(40);
  const [safetyMode, setSafetyMode] = useState<"standard" | "relaxed" | "strict">("standard");
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState("https://api.openai.com");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [geminiModels, setGeminiModels] = useState<any[]>([]);
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const providerDefaults: Record<string, string> = {
    openai: "gpt-3.5-turbo",
    gemini: "gemini-1.5-flash"
  };
  const isGeminiModel = (value: string) => value.startsWith("gemini") || value.startsWith("models/gemini");

  useEffect(() => {
    getAdminSettings().then((res) => {
      setProvider(res.active_provider || "openai");
      setModel(res.active_model || "gpt-3.5-turbo");
      setTemperature(typeof res.temperature === "number" ? res.temperature : 0.7);
      setTopP(typeof res.top_p === "number" ? res.top_p : 1);
      setPresencePenalty(typeof res.presence_penalty === "number" ? res.presence_penalty : 0);
      setFrequencyPenalty(typeof res.frequency_penalty === "number" ? res.frequency_penalty : 0);
      setStopSequences(typeof res.stop_sequences === "string" ? res.stop_sequences : "");
      setMaxTokens(typeof res.max_tokens === "number" ? res.max_tokens : 512);
      setContextLimit(typeof res.context_limit === "number" ? res.context_limit : 40);
      setMemoryLimit(typeof res.memory_limit === "number" ? res.memory_limit : 8);
      setLorebookLimit(typeof res.lorebook_limit === "number" ? res.lorebook_limit : 6);
      setGlobalPrefix(res.global_system_prefix || "");
      setTopK(typeof res.top_k === "number" ? res.top_k : 40);
      setSafetyMode(res.safety_mode || "standard");
      setAllowRegistration(typeof res.allow_registration === "boolean" ? res.allow_registration : true);
      setOpenaiBaseUrl(res.provider_configs?.openai?.baseUrl || "https://api.openai.com");
      setOpenaiKey(res.provider_configs?.openai?.apiKey || "");
      setGeminiKey(res.provider_configs?.gemini?.apiKey || "");
    });
  }, []);

  const loadGeminiModels = async () => {
    try {
      setModelStatus(null);
      const res = await getGeminiModels();
      setGeminiModels(res.models || []);
      setModelStatus(`Loaded ${res.models?.length || 0} models.`);
    } catch (err: any) {
      setModelStatus(err.message || "Failed to load models.");
    }
  };

  const save = async () => {
    try {
      setStatus(null);
      await updateAdminSettings({
        active_provider: provider,
        active_model: model,
        temperature,
        top_p: topP,
        presence_penalty: presencePenalty,
        frequency_penalty: frequencyPenalty,
        stop_sequences: stopSequences,
        max_tokens: maxTokens,
        context_limit: contextLimit,
        memory_limit: memoryLimit,
        lorebook_limit: lorebookLimit,
        global_system_prefix: globalPrefix,
        top_k: topK,
        safety_mode: safetyMode,
        allow_registration: allowRegistration,
        provider_configs: {
          openai: { baseUrl: openaiBaseUrl, apiKey: openaiKey },
          gemini: { apiKey: geminiKey }
        }
      });
      setStatus("Saved.");
    } catch (err: any) {
      setStatus(err.message || "Failed");
    }
  };

  return (
    <div className="grid">
      <h1 className="page-title">Admin Panel</h1>
      <div className="card grid">
        <label>Active provider</label>
        <select
          value={provider}
          onChange={(e) => {
            const next = e.target.value;
            setProvider(next);
            if (next === "gemini" && !isGeminiModel(model)) {
              setModel(providerDefaults.gemini);
            }
            if (next === "openai" && isGeminiModel(model)) {
              setModel(providerDefaults.openai);
            }
          }}
        >
          <option value="openai">OpenAI-compatible</option>
          <option value="gemini">Gemini</option>
        </select>
        <div className="mono" style={{ color: "var(--muted)" }}>
          Suggested: {providerDefaults[provider]}
        </div>
        <label>Active model</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} />
        <label>Temperature</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
        />
        <div className="mono" style={{ color: "var(--muted)" }}>
          {temperature.toFixed(2)}
        </div>
        <label>Top P</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={topP}
          onChange={(e) => setTopP(Number(e.target.value))}
        />
        <div className="mono" style={{ color: "var(--muted)" }}>
          {topP.toFixed(2)}
        </div>
        <label>Presence penalty</label>
        <input
          type="range"
          min="-2"
          max="2"
          step="0.1"
          value={presencePenalty}
          onChange={(e) => setPresencePenalty(Number(e.target.value))}
        />
        <div className="mono" style={{ color: "var(--muted)" }}>
          {presencePenalty.toFixed(2)}
        </div>
        <label>Frequency penalty</label>
        <input
          type="range"
          min="-2"
          max="2"
          step="0.1"
          value={frequencyPenalty}
          onChange={(e) => setFrequencyPenalty(Number(e.target.value))}
        />
        <div className="mono" style={{ color: "var(--muted)" }}>
          {frequencyPenalty.toFixed(2)}
        </div>
        <label>Stop sequences (comma separated)</label>
        <input value={stopSequences} onChange={(e) => setStopSequences(e.target.value)} />
        <label>Max tokens</label>
        <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} />
        <label>Context message limit</label>
        <input type="number" value={contextLimit} onChange={(e) => setContextLimit(Number(e.target.value))} />
        <label>Memory limit</label>
        <input type="number" value={memoryLimit} onChange={(e) => setMemoryLimit(Number(e.target.value))} />
        <label>Lorebook entry limit</label>
        <input type="number" value={lorebookLimit} onChange={(e) => setLorebookLimit(Number(e.target.value))} />
        <label>Top K (Gemini)</label>
        <input type="number" value={topK} onChange={(e) => setTopK(Number(e.target.value))} />
        <label>Safety mode</label>
        <select value={safetyMode} onChange={(e) => setSafetyMode(e.target.value as any)}>
          <option value="standard">Standard</option>
          <option value="relaxed">Relaxed</option>
          <option value="strict">Strict</option>
        </select>
        <label>Global system prefix</label>
        <textarea
          rows={3}
          value={globalPrefix}
          onChange={(e) => setGlobalPrefix(e.target.value)}
          placeholder="Optional safety or style prefix applied to every character."
        />
        <label>Allow new registrations</label>
        <select
          value={allowRegistration ? "yes" : "no"}
          onChange={(e) => setAllowRegistration(e.target.value === "yes")}
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
        <div className="grid grid-2">
          <div className="card">
            <h3>OpenAI-compatible</h3>
            <label>Base URL</label>
            <input value={openaiBaseUrl} onChange={(e) => setOpenaiBaseUrl(e.target.value)} />
            <label>API key</label>
            <input value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
          </div>
          <div className="card">
            <h3>Gemini</h3>
            <label>API key</label>
            <input value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} />
            <div style={{ marginTop: 10 }}>
              <button
                className="ghost-button"
                type="button"
                onClick={loadGeminiModels}
              >
                Fetch Gemini models
              </button>
            </div>
            {modelStatus && <div className="mono" style={{ color: "var(--muted)", marginTop: 6 }}>{modelStatus}</div>}
            {geminiModels.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <label>Pick model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {geminiModels.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.displayName || m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <button onClick={save}>Save Settings</button>
        {status && <div style={{ color: "var(--muted)" }}>{status}</div>}
      </div>
    </div>
  );
}
