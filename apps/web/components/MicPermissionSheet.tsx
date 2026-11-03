"use client";

import { useState } from "react";
import { requestMicAccess } from "../lib/mic";
import { useI18n } from "./I18nProvider";

type Props = {
  open: boolean;
  /** Fired after a real getUserMedia grant (browser prompt accepted). */
  onAllowed: () => void;
  onDismiss: () => void;
};

export function MicPermissionSheet({ open, onAllowed, onDismiss }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleAllow() {
    if (busy) return;
    setBusy(true);
    setError(null);
    // Call getUserMedia directly in this tap handler — required on mobile Safari.
    const result = await requestMicAccess();
    setBusy(false);
    if (result.ok) {
      window.localStorage.setItem("vk_mic_explained", "true");
      onAllowed();
      return;
    }
    if (result.state === "denied") {
      setError(t("mic.statusDeniedHint"));
      return;
    }
    setError(t("mic.statusError"));
  }

  return (
    <div className="sheet-backdrop" role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mic-title"
      >
        <h2 id="mic-title" className="sheet-title">
          {t("mic.title")}
        </h2>
        <p className="sheet-note">{t("mic.note")}</p>
        {error ? (
          <>
            <p className="sheet-note mic-sheet-error">{error}</p>
            <ol className="mic-reset-steps">
              <li>{t("mic.resetStep1")}</li>
              <li>{t("mic.resetStep2")}</li>
              <li>{t("mic.resetStep3")}</li>
            </ol>
          </>
        ) : null}
        <button
          type="button"
          className="sheet-cta"
          disabled={busy}
          onClick={() => void handleAllow()}
        >
          {busy
            ? t("mic.requesting")
            : error
              ? t("mic.tryAgain")
              : t("mic.allow")}
        </button>
        <button type="button" className="sheet-dismiss" onClick={onDismiss} disabled={busy}>
          {t("mic.later")}
        </button>
      </div>
    </div>
  );
}
