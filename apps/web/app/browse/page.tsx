"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconBackRtl } from "../../components/NavIcons";
import { SURAH_META } from "../../lib/content";
import { lessonHref } from "../../lib/progress";
import { AYAH_COUNTS, ayahCount } from "../../lib/surah-catalog";

export default function BrowsePage() {
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
        String(s.id) === needle,
    );
  }, [all, q]);

  return (
    <div className="browse">
      <header className="browse-top">
        <Link href="/" className="top-home" aria-label="الرئيسية">
          <IconBackRtl />
        </Link>
        <h1 className="browse-title">اختر سورة</h1>
      </header>

      <label className="sr-only" htmlFor="surah-search">
        بحث
      </label>
      <input
        id="surah-search"
        className="browse-search"
        type="search"
        placeholder="ابحث عن سورة…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        dir="rtl"
      />

      <section className="browse-list" aria-label="السور">
        {q.trim() ? (
          <p className="browse-section-label">{filtered.length} نتيجة</p>
        ) : null}
        <ul>
          {filtered.map((s) => (
            <li key={s.id}>
              <Link className="browse-row" href={lessonHref(s.id, 1)}>
                <span className="browse-num">{s.id}</span>
                <span className="browse-names">
                  <span className="browse-ar">{s.ar}</span>
                  <span className="browse-en">{s.en}</span>
                </span>
                <span className="browse-ayahs">{s.ayahs} آية</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
