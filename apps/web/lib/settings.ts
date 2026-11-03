import { isLocaleId, type LocaleId } from "./i18n";

export type ThemeId = "cream" | "night";
export type AyahSizeId = "sm" | "md" | "lg";

export const DEFAULT_DAILY_GOAL = 5;
export const MIN_DAILY_GOAL = 1;
export const MAX_DAILY_GOAL = 100;

export type VkSettings = {
  theme: ThemeId;
  ayahSize: AyahSizeId;
  locale: LocaleId;
  dailyGoal: number;
};

const KEY = "vk_settings";

const DEFAULTS: VkSettings = {
  theme: "cream",
  ayahSize: "md",
  locale: "ar",
  dailyGoal: DEFAULT_DAILY_GOAL,
};

export function clampDailyGoal(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return DEFAULT_DAILY_GOAL;
  return Math.min(MAX_DAILY_GOAL, Math.max(MIN_DAILY_GOAL, Math.floor(v)));
}

export function loadSettings(): VkSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Partial<VkSettings>;
    return {
      theme: s.theme === "night" ? "night" : "cream",
      ayahSize: s.ayahSize === "sm" || s.ayahSize === "lg" ? s.ayahSize : "md",
      locale: isLocaleId(s.locale) ? s.locale : "ar",
      dailyGoal: clampDailyGoal(s.dailyGoal ?? DEFAULT_DAILY_GOAL),
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(partial: Partial<VkSettings>): VkSettings {
  const merged = { ...loadSettings(), ...partial };
  const next: VkSettings = {
    ...merged,
    dailyGoal: clampDailyGoal(merged.dailyGoal),
  };
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
