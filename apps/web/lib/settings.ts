export type ThemeId = "cream" | "night";
export type AyahSizeId = "sm" | "md" | "lg";

export type VkSettings = {
  theme: ThemeId;
  ayahSize: AyahSizeId;
};

const KEY = "vk_settings";

const DEFAULTS: VkSettings = {
  theme: "cream",
  ayahSize: "md",
};

export function loadSettings(): VkSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Partial<VkSettings>;
    return {
      theme: s.theme === "night" ? "night" : "cream",
      ayahSize: s.ayahSize === "sm" || s.ayahSize === "lg" ? s.ayahSize : "md",
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(partial: Partial<VkSettings>): VkSettings {
  const next = { ...loadSettings(), ...partial };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    applySettingsToDom(next);
  }
  return next;
}

export function applySettingsToDom(settings: VkSettings = loadSettings()): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.ayahSize = settings.ayahSize;
}
