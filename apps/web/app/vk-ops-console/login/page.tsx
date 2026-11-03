"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/AuthProvider";
import { ADMIN_BASE_PATH } from "../../../lib/admin-path";
import { signInWithIdentifier, signOut } from "../../../lib/auth-api";
import { supabase } from "../../../lib/supabase";

/**
 * Separate admin login — not linked from student/parent UI.
 * Access still requires profiles.role === 'admin'.
 */
export default function OpsLoginPage() {
  const router = useRouter();
  const { ready, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (profile?.role === "admin") {
      router.replace(ADMIN_BASE_PATH);
    }
  }, [ready, profile, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await signInWithIdentifier(email.trim(), password);
    if (!res.ok) {
      setBusy(false);
      setError(
        res.error === "rate_limited"
          ? "Too many attempts. Wait, then try again."
          : res.error === "disabled"
            ? "This account is disabled."
            : res.error === "not_found"
              ? "No admin account for that email/username."
              : "Invalid credentials. Paste the full password from your secrets file.",
      );
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", res.session?.user.id ?? "")
      .maybeSingle();
    if (data?.role !== "admin") {
      await signOut();
      setBusy(false);
      setError("This console is for administrators only.");
      return;
    }
    setBusy(false);
    router.replace(ADMIN_BASE_PATH);
  }

  return (
    <div className="ops-page narrow">
      <h1>Operations console</h1>
      <p className="ops-muted">Authorized administrators only.</p>
      {error ? (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      ) : null}
      <form onSubmit={(e) => void onSubmit(e)} style={{ marginTop: "1.25rem" }}>
        <div className="auth-field">
          <label htmlFor="ops-email">Email or username</label>
          <input
            id="ops-email"
            type="text"
            inputMode="email"
            autoComplete="username"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="ops-pass">Password</label>
          <input
            id="ops-pass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="auth-cta" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
