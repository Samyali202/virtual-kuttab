"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IconBackRtl } from "../../components/NavIcons";
import { useI18n } from "../../components/I18nProvider";
import { signInWithIdentifier } from "../../lib/auth-api";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await signInWithIdentifier(id, password);
    setBusy(false);
    if (!res.ok) {
      setError(
        res.error === "rate_limited"
          ? t("auth.errRateLimited")
          : res.error === "disabled"
            ? t("auth.errDisabled")
            : res.error === "not_found"
              ? t("auth.errNotFound")
              : t("auth.errAuth"),
      );
      return;
    }
    try {
      sessionStorage.setItem("vk_show_merge_hint", "1");
    } catch {
      /* ignore */
    }
    router.replace("/");
  }

  return (
    <div className="auth-page">
      <header className="browse-top">
        <Link href="/" className="top-home" aria-label={t("common.home")}>
          <IconBackRtl />
        </Link>
        <p className="auth-brand">{t("home.kicker")}</p>
        <span style={{ width: 44 }} aria-hidden="true" />
      </header>

      <h1 className="auth-title">{t("auth.loginTitle")}</h1>
      <p className="auth-sub">{t("auth.loginSub")}</p>

      {error ? (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)}>
        <div className="auth-field">
          <label htmlFor="login-id">{t("auth.loginId")}</label>
          <input
            id="login-id"
            autoComplete="username"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="login-pass">{t("auth.password")}</label>
          <input
            id="login-pass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="auth-cta" disabled={busy} aria-busy={busy}>
          {busy ? t("auth.busy") : t("auth.submitLogin")}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/forgot-password">{t("auth.forgotLink")}</Link>
        <Link href="/register">{t("auth.noAccount")}</Link>
      </div>
      <Link href="/" className="auth-guest-btn">
        {t("auth.continueGuest")}
      </Link>
    </div>
  );
}
