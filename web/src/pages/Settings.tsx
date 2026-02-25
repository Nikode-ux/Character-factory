import { useEffect, useState } from "react";
import { getDefaultSettings, loadSettings, saveSettings, type UiSettings } from "../uiSettings";

export default function Settings() {
  const [settings, setSettings] = useState<UiSettings>(getDefaultSettings());

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
  }, []);

  const update = (partial: Partial<UiSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div className="grid">
      <h1 className="page-title">Settings</h1>
      <div className="grid grid-2">
        <div className="card grid">
          <h3>Chat Experience</h3>
          <label>Show timestamps</label>
          <select
            value={settings.showTimestamps ? "yes" : "no"}
            onChange={(e) => update({ showTimestamps: e.target.value === "yes" })}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>

          <label>Typing indicator</label>
          <select
            value={settings.showTypingIndicator ? "on" : "off"}
            onChange={(e) => update({ showTypingIndicator: e.target.value === "on" })}
          >
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>

          <div className="mono">Appearance is now fixed to dark mode globally.</div>
        </div>

        <div className="card">
          <h3>Account</h3>
          <p>Account-level policies and model settings are managed in Admin.</p>
        </div>
      </div>
    </div>
  );
}
