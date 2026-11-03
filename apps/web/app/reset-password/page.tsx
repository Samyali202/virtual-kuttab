"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { IconBackRtl } from "../../components/NavIcons";
import { useI18n } from "../../components/I18nProvider";
import { updatePassword } from "../../lib/auth-api";
import { isValidPassword } from "../../lib/auth-validators";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        setError(t("auth.errGeneric"));
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isValidPassword(password)) {
      setError(t("auth.errPassword"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.errPasswordMatch"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await updatePassword(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.message || t("auth.errGeneric"));
      return;
    }
    router.replace("/");
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

      <h1 className="auth-title">{t("auth.resetTitle")}</h1>
      <p className="auth-sub">{t("auth.resetSub")}</p>

      {error ? (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      ) : null}

      {ready ? (
        <form onSubmit={(e) => void onSubmit(e)}>
          <div className="auth-field">
            <label htmlFor="reset-pass">{t("auth.password")}</label>
            <input
              id="reset-pass"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="reset-confirm">{t("auth.confirmPassword")}</label>
            <input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="auth-cta" disabled={busy} aria-busy={busy}>
            {busy ? t("auth.busy") : t("auth.savePassword")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
