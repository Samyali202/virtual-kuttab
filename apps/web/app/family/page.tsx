"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../components/AuthProvider";
import { IconBackRtl } from "../../components/NavIcons";
import { useI18n } from "../../components/I18nProvider";
import { toLatinDigits } from "../../lib/digits";
import {
  createKid,
  listMyKids,
  resetKidPassword,
  type KidCard,
} from "../../lib/family-api";
import { isValidPassword, isValidUsername, normalizeUsername } from "../../lib/auth-validators";
import { lessonHref } from "../../lib/progress";
import { SURAH_META, surahName } from "../../lib/surah-meta";

export default function FamilyPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { ready, profile } = useAuth();
  const [kids, setKids] = useState<KidCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");

  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPass, setResetPass] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await listMyKids();
    setKids(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!profile) {
      router.replace("/login");
      return;
    }
    if (profile.role !== "parent") {
      router.replace("/");
      return;
    }
    void reload();
  }, [ready, profile, router, reload]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const uname = normalizeUsername(username);
    if (!displayName.trim() || !isValidUsername(uname) || !isValidPassword(password)) {
      setError(t("family.errInput"));
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    const ageNum = age.trim() ? Number(age.replace(/\D/g, "")) : null;
    const res = await createKid({
      displayName: displayName.trim(),
      username: uname,
      password,
      age: ageNum && ageNum >= 1 && ageNum <= 120 ? ageNum : null,
      email: email.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(
        res.error === "username_taken"
          ? t("auth.errUsername")
          : t("family.errCreate"),
      );
      return;
    }
    setOkMsg(t("family.createdOk", { name: displayName.trim() }));
    setDisplayName("");
    setUsername("");
    setPassword("");
    setAge("");
    setEmail("");
    setShowForm(false);
    await reload();
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (!resetFor || busy) return;
    if (!isValidPassword(resetPass)) {
      setError(t("auth.errPassword"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await resetKidPassword(resetFor, resetPass);
    setBusy(false);
    if (!res.ok) {
      setError(t("family.errReset"));
      return;
    }
    setOkMsg(t("family.resetOk"));
    setResetFor(null);
    setResetPass("");
  }

  if (!ready || (profile && profile.role !== "parent" && loading)) {
    return (
      <div className="family-page">
        <p className="ops-muted">{t("auth.busy")}</p>
      </div>
    );
  }

  return (
    <div className="family-page">
      <header className="browse-top">
        <Link href="/" className="top-home" aria-label={t("common.home")}>
          <IconBackRtl />
        </Link>
        <h1 className="browse-title">{t("family.title")}</h1>
      </header>

      <p className="family-lead">{t("family.lead")}</p>

      {error ? (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      ) : null}
      {okMsg ? (
        <p className="auth-merge" role="status">
          {okMsg}
        </p>
      ) : null}

      <button
        type="button"
        className="auth-cta"
        onClick={() => {
          setShowForm((v) => !v);
          setError(null);
        }}
      >
        {showForm ? t("family.cancelAdd") : t("family.addKid")}
      </button>

      {showForm ? (
        <form className="family-form" onSubmit={(e) => void onCreate(e)}>
          <div className="auth-field">
            <label htmlFor="kid-name">{t("auth.displayName")}</label>
            <input
              id="kid-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="kid-user">{t("auth.username")}</label>
            <input
              id="kid-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <p className="hint">{t("auth.usernameHint")}</p>
          </div>
          <div className="auth-field">
            <label htmlFor="kid-pass">{t("auth.password")}</label>
            <input
              id="kid-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="kid-age">{t("auth.age")}</label>
            <input
              id="kid-age"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="kid-email">{t("family.emailOptional")}</label>
            <input
              id="kid-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="hint">{t("family.emailOptionalHint")}</p>
          </div>
          <button type="submit" className="auth-cta" disabled={busy}>
            {busy ? t("auth.busy") : t("family.saveKid")}
          </button>
        </form>
      ) : null}

      {resetFor ? (
        <form className="family-form" onSubmit={(e) => void onReset(e)}>
          <h2 className="family-card-title">{t("family.resetTitle")}</h2>
          <div className="auth-field">
            <label htmlFor="reset-kid-pass">{t("auth.password")}</label>
            <input
              id="reset-kid-pass"
              type="password"
              value={resetPass}
              onChange={(e) => setResetPass(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="auth-cta" disabled={busy}>
            {busy ? t("auth.busy") : t("auth.savePassword")}
          </button>
          <button
            type="button"
            className="auth-guest-btn"
            onClick={() => {
              setResetFor(null);
              setResetPass("");
            }}
          >
            {t("family.cancelAdd")}
          </button>
        </form>
      ) : null}

      <section className="family-list" aria-label={t("family.kidsList")}>
        {loading ? (
          <p className="ops-muted">{t("auth.busy")}</p>
        ) : kids.length === 0 ? (
          <p className="family-empty">{t("family.empty")}</p>
        ) : (
          kids.map((k) => {
            const meta = k.bookmark ? SURAH_META[k.bookmark.surah] : null;
            return (
              <article key={k.profile.id} className="family-card">
                <h2 className="family-card-title">
                  {k.profile.display_name || k.profile.username}
                </h2>
                <p className="family-meta">
                  {k.profile.username ? `@${k.profile.username}` : ""}
                  {k.profile.age != null
                    ? ` · ${toLatinDigits(k.profile.age)}`
                    : ""}
                </p>
                {k.bookmark && meta ? (
                  <p className="family-progress">
                    {t("family.continueAt")}{" "}
                    <Link href={lessonHref(k.bookmark.surah, k.bookmark.ayah)}>
                      {surahName(k.bookmark.surah, locale)} · {t("common.ayah")}{" "}
                      {toLatinDigits(k.bookmark.ayah)}
                    </Link>
                  </p>
                ) : (
                  <p className="family-progress muted">{t("family.noProgress")}</p>
                )}
                <p className="family-stats">
                  {t("home.streakLabel")}:{" "}
                  <span className="latin-num">
                    {toLatinDigits(k.stats?.streak ?? 0)}
                  </span>
                  {" · "}
                  {t("home.goalLabel")}:{" "}
                  <span className="latin-num">
                    {toLatinDigits(k.stats?.todayCount ?? 0)}
                  </span>
                </p>
                <button
                  type="button"
                  className="family-reset"
                  onClick={() => {
                    setResetFor(k.profile.id);
                    setResetPass("");
                    setError(null);
                    setOkMsg(null);
                  }}
                >
                  {t("family.resetPassword")}
                </button>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
