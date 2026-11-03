"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { IconBackRtl } from "../../components/NavIcons";
import { useI18n } from "../../components/I18nProvider";
import { requestPasswordReset } from "../../lib/auth-api";
import { isValidEmail } from "../../lib/auth-validators";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isValidEmail(email)) {
      setError(t("auth.errEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    const redirectTo = `${window.location.origin}/reset-password`;
    const res = await requestPasswordReset(email, redirectTo);
    setBusy(false);
    if (!res.ok) {
      setError(
        res.code === "rate_limited" || res.message === "rate_limited"
          ? t("auth.errRateLimited")
          : res.message || t("auth.errGeneric"),
      );
      return;
    }
    setSent(true);
  }

  return (
    <div className="auth-page">
      <header className="browse-top">
        <Link href="/login" className="top-home" aria-label={t("auth.backLogin")}>
          <IconBackRtl />
        </Link>
        <p className="auth-brand">{t("home.kicker")}</p>
        <span style={{ width: 44 }} aria-hidden="true" />
      </header>

      <h1 className="auth-title">{t("auth.forgotTitle")}</h1>
      <p className="auth-sub">{t("auth.forgotSub")}</p>

      {error ? (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      ) : null}

      {sent ? (
        <p className="auth-ok" role="status">
          {t("auth.resetSent")}
        </p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)}>
          <div className="auth-field">
            <label htmlFor="forgot-email">{t("auth.email")}</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="auth-cta" disabled={busy} aria-busy={busy}>
            {busy ? t("auth.busy") : t("auth.sendReset")}
          </button>
        </form>
      )}

      <div className="auth-links">
        <Link href="/login">{t("auth.backLogin")}</Link>
      </div>
    </div>
  );
}
