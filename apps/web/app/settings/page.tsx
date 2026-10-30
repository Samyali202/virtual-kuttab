"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconBackRtl } from "../../components/NavIcons";
import {
  applySettingsToDom,
  loadSettings,
  saveSettings,
  type AyahSizeId,
  type ThemeId,
} from "../../lib/settings";

const SENSITIVITY = [
  { value: "child", ar: "مبتدئ" },
  { value: "beginner", ar: "متوسط" },
  { value: "professional", ar: "مُتقِن" },
] as const;

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeId>("cream");
  const [ayahSize, setAyahSize] = useState<AyahSizeId>("md");
  const [mode, setMode] = useState("beginner");

  useEffect(() => {
    const s = loadSettings();
    setTheme(s.theme);
    setAyahSize(s.ayahSize);
    applySettingsToDom(s);
    const m = window.localStorage.getItem("vk_sensitivity");
    if (m === "child" || m === "beginner" || m === "professional") setMode(m);
  }, []);

  return (
    <div className="settings">
      <header className="browse-top">
        <Link href="/" className="top-home" aria-label="الرئيسية">
          <IconBackRtl />
        </Link>
        <h1 className="browse-title">الإعدادات</h1>
      </header>

      <section className="settings-block">
        <h2 className="settings-label">المظهر</h2>
        <div className="settings-row">
          {(
            [
              { id: "cream", ar: "مصحف فاتح" },
              { id: "night", ar: "ليلي" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className={theme === t.id ? "mode-pill active" : "mode-pill"}
              onClick={() => {
                setTheme(t.id);
                saveSettings({ theme: t.id });
              }}
            >
              {t.ar}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-block">
        <h2 className="settings-label">حجم نص الآية</h2>
        <div className="settings-row">
          {(
            [
              { id: "sm", ar: "صغير" },
              { id: "md", ar: "وسط" },
              { id: "lg", ar: "كبير" },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              className={ayahSize === s.id ? "mode-pill active" : "mode-pill"}
              onClick={() => {
                setAyahSize(s.id);
                saveSettings({ ayahSize: s.id });
              }}
            >
              {s.ar}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-block">
        <h2 className="settings-label">مستوى الدقة</h2>
        <div className="settings-row">
          {SENSITIVITY.map((s) => (
            <button
              key={s.value}
              type="button"
              className={mode === s.value ? "mode-pill active" : "mode-pill"}
              onClick={() => {
                setMode(s.value);
                window.localStorage.setItem("vk_sensitivity", s.value);
              }}
            >
              {s.ar}
            </button>
          ))}
        </div>
      </section>

      <p className="settings-foot">الإعدادات تُحفظ على هذا الجهاز فقط</p>
    </div>
  );
}
