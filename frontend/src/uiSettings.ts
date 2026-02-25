export type UiSettings = {
  showTimestamps: boolean;
  showTypingIndicator: boolean;
};

const DEFAULT_SETTINGS: UiSettings = {
  showTimestamps: true,
  showTypingIndicator: true
};

export function loadSettings(): UiSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem("pf_settings");
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      showTimestamps:
        typeof parsed?.showTimestamps === "boolean" ? parsed.showTimestamps : DEFAULT_SETTINGS.showTimestamps,
      showTypingIndicator:
        typeof parsed?.showTypingIndicator === "boolean"
          ? parsed.showTypingIndicator
          : DEFAULT_SETTINGS.showTypingIndicator
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function applySettings(_: UiSettings) {
  // UI is fixed dark mode; only behavioral settings remain.
}

export function saveSettings(settings: UiSettings) {
  localStorage.setItem("pf_settings", JSON.stringify(settings));
  window.dispatchEvent(new Event("pf-settings"));
}

export function getDefaultSettings() {
  return DEFAULT_SETTINGS;
}
