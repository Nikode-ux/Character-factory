import { useState } from "react";
import { login, register, setAuthToken, type User } from "../api";

export default function Auth({ onAuthed }: { onAuthed: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      setError(null);
      if (mode === "login") {
        const res = await login(email, password);
        if (res.token) setAuthToken(res.token);
        onAuthed(res);
      } else {
        const res = await register(email, password);
        if (res.token) setAuthToken(res.token);
        onAuthed(res);
      }
    } catch (err: any) {
      setError(err.message || "Failed");
    }
  };

  return (
    <div className="main" style={{ maxWidth: 420, margin: "0 auto" }}>
      <h1 className="page-title">Persona Forge</h1>
      <p className="mono" style={{ color: "var(--muted)" }}>
        Craft characters. Spark conversations. Keep it private.
      </p>
      <div className="card" style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <div className="grid">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div style={{ color: "#ff9b7a" }}>{error}</div>}
        <button onClick={submit}>{mode === "login" ? "Login" : "Create account"}</button>
        <button
          style={{ background: "transparent", color: "var(--accent-2)", border: "1px solid var(--stroke)" }}
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account?" : "Have an account?"}
        </button>
      </div>
    </div>
  );
}
