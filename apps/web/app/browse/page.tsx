"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconBackRtl } from "../../components/NavIcons";
import { useI18n } from "../../components/I18nProvider";
import { toLatinDigits } from "../../lib/digits";
import { lessonHref } from "../../lib/progress";
import { AYAH_COUNTS, ayahCount } from "../../lib/surah-catalog";
import { SURAH_META, surahName } from "../../lib/surah-meta";

export default function BrowsePage() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");

  const all = useMemo(
    () =>
      Object.keys(SURAH_META)
        .map(Number)
        .sort((a, b) => a - b)
        .map((id) => ({
          id,
          ar: SURAH_META[id].ar,
          en: SURAH_META[id].en,
          ru: SURAH_META[id].ru,
          ayahs: ayahCount(id) || AYAH_COUNTS[id] || 0,
        })),
    [],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (s) =>
        s.ar.includes(q.trim()) ||
        s.en.toLowerCase().includes(needle) ||
        s.ru.toLowerCase().includes(needle) ||
        String(s.id) === needle,
    );
  }, [all, q]);

  return (
    <div className="browse">
      <header className="browse-top">
        <Link href="/" className="top-home" aria-label={t("common.home")}>
          <IconBackRtl />
        </Link>
        <h1 className="browse-title">{t("browse.title")}</h1>
      </header>

      <label className="sr-only" htmlFor="surah-search">
        {t("browse.searchAria")}
      </label>
      <input
        id="surah-search"
        className="browse-search"
        type="search"
        placeholder={t("browse.search")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        dir={locale === "en" ? "ltr" : "rtl"}
      />

      <section className="browse-list" aria-label={t("common.surahs")}>
        {q.trim() ? (
          <p className="browse-section-label">
            <span className="latin-num">{toLatinDigits(filtered.length)}</span>{" "}
            {t("common.results")}
          </p>
        ) : null}
        <ul>
          {filtered.map((s) => (
            <li key={s.id}>
              <Link className="browse-row" href={lessonHref(s.id, 1)}>
                <span className="browse-num latin-num">{toLatinDigits(s.id)}</span>
                <span className="browse-names">
                  <span className="browse-ar">{surahName(s.id, locale)}</span>
                  <span className="browse-en mushaf-ar" lang="ar" dir="rtl">
                    {s.ar}
                  </span>
                </span>
                <span className="browse-ayahs">
                  <span className="latin-num">{toLatinDigits(s.ayahs)}</span>{" "}
                  {t("common.ayahs")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
