"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  dirFor,
  isLocaleId,
  messagesFor,
  t as translate,
  type DotPath,
  type LocaleId,
} from "../lib/i18n";
import { loadSettings, saveSettings } from "../lib/settings";

type I18nCtx = {
  locale: LocaleId;
  dir: "rtl" | "ltr";
  messages: ReturnType<typeof messagesFor>;
  setLocale: (locale: LocaleId) => void;
  t: (path: DotPath | string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId>("ar");

  useEffect(() => {
    const s = loadSettings();
    if (isLocaleId(s.locale)) setLocaleState(s.locale);
  }, []);

  useEffect(() => {
    const dir = dirFor(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  const setLocale = useCallback((next: LocaleId) => {
    setLocaleState(next);
    saveSettings({ locale: next });
  }, []);

  const value = useMemo<I18nCtx>(() => {
    const dir = dirFor(locale);
    return {
      locale,
      dir,
      messages: messagesFor(locale),
      setLocale,
      t: (path, vars) => translate(locale, path, vars),
    };
  }, [locale, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
