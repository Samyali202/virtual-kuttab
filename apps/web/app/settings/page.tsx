"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LocalePicker } from "../../components/LocalePicker";
import { MicStatusButton } from "../../components/MicStatusButton";
import { IconBackRtl } from "../../components/NavIcons";
import { useI18n } from "../../components/I18nProvider";
import { toLatinDigits } from "../../lib/digits";
import {
  applySettingsToDom,
  clampDailyGoal,
  loadSettings,
  MAX_DAILY_GOAL,
  MIN_DAILY_GOAL,
  saveSettings,
  type AyahSizeId,
  type ThemeId,
} from "../../lib/settings";

const SENSITIVITY = [
  { value: "child", key: "settings.levelChild" as const },
  { value: "beginner", key: "settings.levelBeginner" as const },
  { value: "professional", key: "settings.levelPro" as const },
] as const;

export default function SettingsPage() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<ThemeId>("cream");
  const [ayahSize, setAyahSize] = useState<AyahSizeId>("md");
  const [mode, setMode] = useState("beginner");
  const [dailyGoal, setDailyGoal] = useState(5);
  const [goalDraft, setGoalDraft] = useState("5");

  useEffect(() => {
    const s = loadSettings();
    setTheme(s.theme);
    setAyahSize(s.ayahSize);
    setDailyGoal(s.dailyGoal);
    setGoalDraft(toLatinDigits(s.dailyGoal));
    applySettingsToDom(s);
    const m = window.localStorage.getItem("vk_sensitivity");
    if (m === "child" || m === "beginner" || m === "professional") setMode(m);
  }, []);

  function commitGoal(raw: number | string) {
    const next = clampDailyGoal(raw);
    setDailyGoal(next);
    setGoalDraft(toLatinDigits(next));
    saveSettings({ dailyGoal: next });
  }

  function bumpGoal(delta: number) {
    commitGoal(dailyGoal + delta);
  }

  return (
    <div className="settings">
      <header className="browse-top">
        <Link href="/" className="top-home" aria-label={t("common.home")}>
          <IconBackRtl />
        </Link>
        <h1 className="browse-title">{t("settings.title")}</h1>
      </header>

      <section className="settings-block">
        <h2 className="settings-label">{t("mic.settingsTitle")}</h2>
        <p className="settings-hint">{t("mic.note")}</p>
        <MicStatusButton />
      </section>

      <section className="settings-block">
        <h2 className="settings-label">{t("settings.language")}</h2>
        <LocalePicker variant="block" />
      </section>

      <section className="settings-block">
        <h2 className="settings-label">{t("settings.dailyGoal")}</h2>
        <p className="settings-hint">{t("settings.dailyGoalHint")}</p>
        <div className="goal-stepper" role="group" aria-label={t("settings.dailyGoal")}>
          <button
            type="button"
            className="goal-stepper-btn"
            aria-label="−"
            disabled={dailyGoal <= MIN_DAILY_GOAL}
            onClick={() => bumpGoal(-1)}
          >
            −
          </button>
          <input
            className="goal-stepper-input latin-num"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={goalDraft}
            aria-valuemin={MIN_DAILY_GOAL}
            aria-valuemax={MAX_DAILY_GOAL}
            aria-valuenow={dailyGoal}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^\d]/g, "");
              setGoalDraft(cleaned);
            }}
            onBlur={() => commitGoal(goalDraft === "" ? dailyGoal : goalDraft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
          />
          <button
            type="button"
            className="goal-stepper-btn"
            aria-label="+"
            disabled={dailyGoal >= MAX_DAILY_GOAL}
            onClick={() => bumpGoal(1)}
          >
            +
          </button>
        </div>
      </section>

      <section className="settings-block">
        <h2 className="settings-label">{t("settings.theme")}</h2>
        <div className="settings-row">
          {(
            [
              { id: "cream" as ThemeId, label: t("settings.themeCream") },
              { id: "night" as ThemeId, label: t("settings.themeNight") },
            ] as const
          ).map((th) => (
            <button
              key={th.id}
              type="button"
              className={theme === th.id ? "mode-pill active" : "mode-pill"}
              onClick={() => {
                setTheme(th.id);
                saveSettings({ theme: th.id });
              }}
            >
              {th.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-block">
        <h2 className="settings-label">{t("settings.ayahSize")}</h2>
        <div className="settings-row">
          {(
            [
              { id: "sm" as AyahSizeId, label: t("settings.sizeSm") },
              { id: "md" as AyahSizeId, label: t("settings.sizeMd") },
              { id: "lg" as AyahSizeId, label: t("settings.sizeLg") },
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
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-block">
        <h2 className="settings-label">{t("settings.level")}</h2>
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
              {t(s.key)}
            </button>
          ))}
        </div>
      </section>

      <p className="settings-foot">{t("settings.foot")}</p>
    </div>
  );
}
