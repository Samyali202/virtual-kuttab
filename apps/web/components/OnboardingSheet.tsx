"use client";

import { toLatinDigits } from "../lib/digits";
import { useI18n } from "./I18nProvider";

type Props = {
  open: boolean;
  onDone: () => void;
};

export function OnboardingSheet({ open, onDone }: Props) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-title"
      >
        <h2 id="onboard-title" className="sheet-title">
          {t("onboarding.title")}
        </h2>
        <ol className="sheet-steps">
          <li>
            <strong className="latin-num">{toLatinDigits(1)}</strong>{" "}
            {t("onboarding.step1")}
          </li>
          <li>
            <strong className="latin-num">{toLatinDigits(2)}</strong>{" "}
            {t("onboarding.step2")}
          </li>
          <li>
            <strong className="latin-num">{toLatinDigits(3)}</strong>{" "}
            {t("onboarding.step3")}
          </li>
        </ol>
        <p className="sheet-note">{t("onboarding.note")}</p>
        <button type="button" className="sheet-cta" onClick={onDone}>
          {t("onboarding.cta")}
        </button>
      </div>
    </div>
  );
}
