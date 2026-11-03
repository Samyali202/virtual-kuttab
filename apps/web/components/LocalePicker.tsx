"use client";

import { useEffect, useId, useState } from "react";
import { LOCALES, type LocaleId } from "../lib/i18n";
import { useI18n } from "./I18nProvider";

type Props = {
  /** Compact toolbar trigger (home) vs full-width settings row. */
  variant?: "chip" | "block";
  className?: string;
};

export function LocalePicker({ variant = "chip", className }: Props) {
  const { t, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const current = LOCALES.find((opt) => opt.id === locale) ?? LOCALES[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function pick(next: LocaleId) {
    setLocale(next);
    setOpen(false);
  }

  return (
    <div className={className ? `locale-picker ${className}` : "locale-picker"}>
      <button
        type="button"
        className={
          variant === "block" ? "locale-trigger block" : "locale-trigger chip"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("home.languageSelect")}
        title={t("home.languageSelect")}
        onClick={() => setOpen(true)}
      >
        <span className="locale-chip-label" dir="ltr">
          <span className="locale-flag" aria-hidden="true">
            {current.flag}
          </span>
          <span className="locale-sample">{current.sample}</span>
        </span>
      </button>

      {open ? (
        <div
          className="sheet-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="sheet locale-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className="sheet-title">
              {t("settings.language")}
            </h2>
            <div className="locale-options" role="listbox" aria-label={t("settings.language")}>
              {LOCALES.map((opt) => {
                const selected = opt.id === locale;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={selected ? "locale-option active" : "locale-option"}
                    onClick={() => pick(opt.id)}
                  >
                    <span className="locale-flag" aria-hidden="true">
                      {opt.flag}
                    </span>
                    <span className="locale-sample">{opt.sample}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="sheet-dismiss"
              onClick={() => setOpen(false)}
            >
              {t("lesson.later")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
