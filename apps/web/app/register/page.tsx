"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IconBackRtl } from "../../components/NavIcons";
import { useI18n } from "../../components/I18nProvider";
import {
  isUsernameAvailable,
  signUpStudentOrParent,
} from "../../lib/auth-api";
import {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
  PHONE_COUNTRIES,
  toE164,
} from "../../lib/auth-validators";

export default function RegisterPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [role, setRole] = useState<"learner" | "parent">("learner");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("966");
  const [national, setNational] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    const uname = normalizeUsername(username);
    if (!displayName.trim()) errs.displayName = t("auth.errGeneric");
    if (!isValidUsername(uname)) errs.username = t("auth.errUsername");
    const phone = toE164(country, national);
    if (!phone) errs.phone = t("auth.errPhone");
    if (!isValidEmail(email)) errs.email = t("auth.errEmail");
    if (!isValidPassword(password)) errs.password = t("auth.errPassword");
    if (password !== confirm) errs.confirm = t("auth.errPasswordMatch");
    let ageNum: number | null = null;
    if (age.trim()) {
      ageNum = Number(age.replace(/\D/g, ""));
      if (!Number.isFinite(ageNum) || ageNum < 1 || ageNum > 120) {
        errs.age = t("auth.errGeneric");
      }
    }
    setFieldErr(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setError(null);
    const available = await isUsernameAvailable(uname);
    if (!available) {
      setBusy(false);
      setFieldErr({ username: t("auth.errUsername") });
      return;
    }

    const res = await signUpStudentOrParent({
      email,
      password,
      displayName: displayName.trim(),
      username: uname,
      phoneE164: phone!,
      age: ageNum,
      role,
      locale,
    });
    setBusy(false);
    if (!res.ok) {
      setError(
        res.code === "rate_limited" || res.message === "rate_limited"
          ? t("auth.errRateLimited")
          : res.message || t("auth.errGeneric"),
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

      <h1 className="auth-title">{t("auth.registerTitle")}</h1>
      <p className="auth-sub">{t("auth.registerSub")}</p>
      <p className="auth-merge">{t("auth.mergeGuestHint")}</p>

      {error ? (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      ) : null}

      <div className="auth-seg" role="group" aria-label={t("auth.registerTitle")}>
        <button
          type="button"
          className={role === "learner" ? "active" : undefined}
          aria-pressed={role === "learner"}
          onClick={() => setRole("learner")}
        >
          {t("auth.roleStudent")}
        </button>
        <button
          type="button"
          className={role === "parent" ? "active" : undefined}
          aria-pressed={role === "parent"}
          onClick={() => setRole("parent")}
        >
          {t("auth.roleParent")}
        </button>
      </div>

      <form onSubmit={(e) => void onSubmit(e)}>
        <div className={fieldErr.displayName ? "auth-field err" : "auth-field"}>
          <label htmlFor="reg-name">{t("auth.displayName")}</label>
          <input
            id="reg-name"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>
        <div className={fieldErr.username ? "auth-field err" : "auth-field"}>
          <label htmlFor="reg-user">{t("auth.username")}</label>
          <input
            id="reg-user"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <p className="hint">{fieldErr.username || t("auth.usernameHint")}</p>
        </div>
        <div className={fieldErr.phone ? "auth-field err" : "auth-field"}>
          <label htmlFor="reg-phone">{t("auth.phone")}</label>
          <div className="auth-phone-row">
            <select
              aria-label={t("auth.country")}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {PHONE_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              id="reg-phone"
              inputMode="tel"
              autoComplete="tel-national"
              value={national}
              onChange={(e) => setNational(e.target.value)}
              required
            />
          </div>
          <p className="hint">{fieldErr.phone || t("auth.phoneHint")}</p>
        </div>
        <div className={fieldErr.age ? "auth-field err" : "auth-field"}>
          <label htmlFor="reg-age">{t("auth.age")}</label>
          <input
            id="reg-age"
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div className={fieldErr.email ? "auth-field err" : "auth-field"}>
          <label htmlFor="reg-email">{t("auth.email")}</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {fieldErr.email ? <p className="hint">{fieldErr.email}</p> : null}
        </div>
        <div className={fieldErr.password ? "auth-field err" : "auth-field"}>
          <label htmlFor="reg-pass">{t("auth.password")}</label>
          <input
            id="reg-pass"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {fieldErr.password ? <p className="hint">{fieldErr.password}</p> : null}
        </div>
        <div className={fieldErr.confirm ? "auth-field err" : "auth-field"}>
          <label htmlFor="reg-confirm">{t("auth.confirmPassword")}</label>
          <input
            id="reg-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {fieldErr.confirm ? <p className="hint">{fieldErr.confirm}</p> : null}
        </div>
        <button type="submit" className="auth-cta" disabled={busy} aria-busy={busy}>
          {busy ? t("auth.busy") : t("auth.submitRegister")}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/login">{t("auth.haveAccount")}</Link>
      </div>
      <Link href="/" className="auth-guest-btn">
        {t("auth.continueGuest")}
      </Link>
    </div>
  );
}
