"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountChip } from "../components/AccountChip";
import { LocalePicker } from "../components/LocalePicker";
import { IconGear, IconMoon, IconSun } from "../components/NavIcons";
import { useAuth } from "../components/AuthProvider";
import { useI18n } from "../components/I18nProvider";
import { toLatinDigits } from "../lib/digits";
import { lessonHref, loadProgress, type HifzProgress } from "../lib/progress";
import { SURAH_META, surahName } from "../lib/surah-meta";
import {
  loadSettings,
  saveSettings,
  type ThemeId,
} from "../lib/settings";
import { loadStats, type HifzStats } from "../lib/stats";

export default function HomePage() {
  const { t, locale } = useI18n();
  const { ready, profile, signOutLocal } = useAuth();
  const [progress, setProgress] = useState<HifzProgress | null>(null);
  const [stats, setStats] = useState<HifzStats | null>(null);
  const [theme, setTheme] = useState<ThemeId>("cream");
  const [dailyGoal, setDailyGoal] = useState(5);
  const [mergedHint, setMergedHint] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setTheme(s.theme);
    setDailyGoal(s.dailyGoal);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      if (profile) {
        try {
          const { mergeGuestProgressOnAuth } = await import("../lib/sync-progress");
          const merged = await mergeGuestProgressOnAuth();
          if (cancelled) return;
          setProgress(merged.progress);
          setStats(merged.stats);
          try {
            if (sessionStorage.getItem("vk_show_merge_hint")) {
              setMergedHint(true);
              sessionStorage.removeItem("vk_show_merge_hint");
            }
          } catch {
            /* ignore */
          }
          return;
        } catch {
          /* fall through to local */
        }
      }
      if (!cancelled) {
        setProgress(loadProgress());
        setStats(loadStats());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, profile]);

  const meta = progress ? SURAH_META[progress.surah] : null;
  const resultLabel =
    progress?.perfect === true
      ? t("home.perfect")
      : progress?.perfect === false
        ? progress.badCount > 0
          ? t("home.wordsToReview", { n: toLatinDigits(progress.badCount) })
          : t("home.retry")
        : null;

  const todayCount = stats?.todayCount ?? 0;
  const streak = stats?.streak ?? 0;
  const goalPct = Math.min(100, Math.round((todayCount / dailyGoal) * 100));
  const showEmptyHint = streak === 0 && todayCount === 0;

  function toggleTheme() {
    const next: ThemeId = theme === "night" ? "cream" : "night";
    setTheme(next);
    saveSettings({ theme: next });
  }

  return (
    <div className="home">
      <header className="home-header">
        <h1
          className={
            locale === "ar" ? "home-kicker home-kicker-ar" : "home-kicker home-kicker-latin"
          }
        >
          {t("home.kicker")}
        </h1>
        <div className="home-toolbar" role="toolbar" aria-label={t("home.kicker")}>
          {/* RTL visual order (right→left): Language · Theme · Account · Settings */}
          <LocalePicker />
          <button
            type="button"
            className="nav-chip home-theme-toggle"
            onClick={toggleTheme}
            aria-label={
              theme === "night"
                ? t("home.themeToggleLight")
                : t("home.themeToggleNight")
            }
            title={
              theme === "night"
                ? t("home.themeToggleLight")
                : t("home.themeToggleNight")
            }
          >
            {theme === "night" ? <IconSun /> : <IconMoon />}
          </button>
          <AccountChip />
          <Link
            href="/settings"
            className="nav-chip home-settings"
            aria-label={t("common.settingsAria")}
            title={t("common.settings")}
          >
            <IconGear />
          </Link>
        </div>
        <p className="home-title">{t("home.title")}</p>
        <p className="home-sub">{t("home.sub")}</p>
        {mergedHint ? (
          <p className="auth-merge" role="status">
            {t("auth.mergeDone")}
          </p>
        ) : null}
      </header>

      <section className="home-stats" aria-label={t("home.goalLabel")}>
        <div className={streak === 0 ? "stat-card streak empty" : "stat-card streak"}>
          <span className="stat-value latin-num">{toLatinDigits(streak)}</span>
          <span className="stat-label">{t("home.streakLabel")}</span>
        </div>
        <div className={todayCount === 0 ? "stat-card goal empty" : "stat-card goal"}>
          <div
            className="goal-ring"
            style={{ ["--goal-pct" as string]: `${goalPct}%` }}
            aria-hidden="true"
          >
            <span className="goal-ring-text latin-num">
              {toLatinDigits(todayCount)}/{toLatinDigits(dailyGoal)}
            </span>
          </div>
          <span className="stat-label">{t("home.goalLabel")}</span>
        </div>
      </section>

      {showEmptyHint ? (
        <p className="home-empty-hint">{t("home.emptyHint")}</p>
      ) : null}

      {progress && meta ? (
        <>
          <Link
            className="continue-card continue-primary"
            href={lessonHref(progress.surah, progress.ayah)}
          >
            <span className="continue-label">{t("home.continueLabel")}</span>
            <span className="continue-ayah">
              {surahName(progress.surah, locale)} · {t("common.ayah")}{" "}
              {toLatinDigits(progress.ayah)}
            </span>
            {resultLabel ? (
              <span
                className={
                  progress.perfect ? "continue-badge ok" : "continue-badge warn"
                }
              >
                {resultLabel}
              </span>
            ) : null}
            <span className="continue-cta-label">{t("home.continueCta")}</span>
          </Link>
          <Link className="home-secondary" href="/browse">
            {t("home.startNew")}
          </Link>
        </>
      ) : (
        <>
          <Link className="home-primary" href="/browse">
            {t("home.start")}
          </Link>
          <Link className="home-secondary" href="/browse">
            {t("common.browseSurahs")}
          </Link>
        </>
      )}

      {profile?.role === "parent" ? (
        <Link className="home-secondary" href="/family">
          {t("family.openFamily")}
        </Link>
      ) : null}

      {profile ? (
        <button
          type="button"
          className="home-secondary"
          onClick={() => void signOutLocal()}
        >
          {t("auth.logout")}
        </button>
      ) : null}

      <p className="home-foot">{t("home.foot")}</p>
    </div>
  );
}
