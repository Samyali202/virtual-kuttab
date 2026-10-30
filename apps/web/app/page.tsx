"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconGear } from "../components/NavIcons";
import { SURAH_META } from "../lib/content";
import { lessonHref, loadProgress, type HifzProgress } from "../lib/progress";
import { DAILY_GOAL, loadStats, type HifzStats } from "../lib/stats";

export default function HomePage() {
  const [progress, setProgress] = useState<HifzProgress | null>(null);
  const [stats, setStats] = useState<HifzStats | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
    setStats(loadStats());
  }, []);

  const meta = progress ? SURAH_META[progress.surah] : null;
  const resultLabel =
    progress?.perfect === true
      ? "أحسنت"
      : progress?.perfect === false
        ? progress.badCount > 0
          ? `${progress.badCount} كلمة للمراجعة`
          : "حاول مجدداً"
        : null;

  const todayCount = stats?.todayCount ?? 0;
  const streak = stats?.streak ?? 0;
  const goalPct = Math.min(100, Math.round((todayCount / DAILY_GOAL) * 100));

  return (
    <div className="home">
      <header className="home-header">
        <div className="home-header-row">
          <p className="home-kicker">الكتّاب الافتراضي</p>
          <Link href="/settings" className="nav-chip" aria-label="الإعدادات">
            <IconGear />
            <span>إعدادات</span>
          </Link>
        </div>
        <h1 className="home-title">حفظ آية بآية</h1>
        <p className="home-sub">استمع للمعلّم · كرّر · سجّل · راجع الكلمات</p>
      </header>

      <section className="home-stats" aria-label="التقدّم اليومي">
        <div className="stat-card streak">
          <span className="stat-value">{streak}</span>
          <span className="stat-label">يوم متتالٍ</span>
        </div>
        <div className="stat-card goal">
          <div
            className="goal-ring"
            style={{ ["--goal-pct" as string]: `${goalPct}%` }}
            aria-hidden="true"
          >
            <span className="goal-ring-text">
              {todayCount}/{DAILY_GOAL}
            </span>
          </div>
          <span className="stat-label">هدف اليوم</span>
        </div>
      </section>

      {progress && meta ? (
        <Link
          className="continue-card"
          href={lessonHref(progress.surah, progress.ayah)}
        >
          <span className="continue-label">أكمل من حيث توقّفت</span>
          <span className="continue-ayah">
            {meta.ar} · آية {progress.ayah}
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
        </Link>
      ) : null}

      <Link className="home-primary" href="/browse">
        {progress ? "ابدأ حفظاً جديداً" : "ابدأ الحفظ"}
      </Link>

      <Link className="home-secondary" href="/browse">
        تصفّح السور
      </Link>

      <p className="home-foot">حصري معلّم · تغذية راجعة على مستوى الكلمة</p>
    </div>
  );
}
