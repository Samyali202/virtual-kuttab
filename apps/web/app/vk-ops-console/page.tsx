"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { adminHref } from "../../lib/admin-path";
import {
  adminCountAttempts,
  adminCreateUser,
  adminFetchRateLimits,
  adminListProfiles,
  adminResetUserPassword,
  adminSetUserDisabled,
  type ProfileRow,
  type RateLimitRow,
} from "../../lib/auth-api";

type RoleFilter = "all" | "learner" | "parent" | "admin" | "disabled";

export default function OpsConsolePage() {
  const router = useRouter();
  const { ready, profile, signOutLocal } = useAuth();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [rates, setRates] = useState<RateLimitRow[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"learner" | "parent">("learner");
  const [phone, setPhone] = useState("");

  const [resetFor, setResetFor] = useState<ProfileRow | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const reload = useCallback(async () => {
    const [list, count, rateRows] = await Promise.all([
      adminListProfiles(300),
      adminCountAttempts(),
      adminFetchRateLimits(40),
    ]);
    setRows(list);
    setAttempts(count);
    setRates(rateRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!profile) {
      router.replace(adminHref("login"));
      return;
    }
    if (profile.role !== "admin") {
      void signOutLocal().then(() => router.replace(adminHref("login")));
      return;
    }
    void reload();
  }, [ready, profile, router, signOutLocal, reload]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "all") return true;
      if (filter === "disabled") return Boolean(r.disabled);
      return r.role === filter;
    });
  }, [rows, filter]);

  const stats = useMemo(() => {
    const students = rows.filter((r) => r.role === "learner").length;
    const parents = rows.filter((r) => r.role === "parent").length;
    const admins = rows.filter((r) => r.role === "admin").length;
    const disabled = rows.filter((r) => r.disabled).length;
    return { students, parents, admins, total: rows.length, attempts, disabled };
  }, [rows, attempts]);

  async function toggleDisabled(r: ProfileRow) {
    if (r.role === "admin" || r.id === profile?.id) {
      setMsg("Cannot disable admin or yourself.");
      return;
    }
    setBusyId(r.id);
    setMsg(null);
    const next = !r.disabled;
    const res = await adminSetUserDisabled(r.id, next);
    setBusyId(null);
    if (!res.ok) {
      setMsg(res.message || "Update failed");
      return;
    }
    setRows((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, disabled: next } : x)),
    );
    setMsg(next ? `Disabled ${r.display_name || r.username}` : `Enabled ${r.display_name || r.username}`);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (createBusy) return;
    setCreateBusy(true);
    setMsg(null);
    const res = await adminCreateUser({
      displayName: displayName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password,
      role,
      phoneE164: phone.trim() || undefined,
      locale: "ar",
    });
    setCreateBusy(false);
    if (!res.ok) {
      setMsg(res.message || "Create failed");
      return;
    }
    setMsg(
      `Created ${role === "parent" ? "parent" : "student"} @${username.trim().toLowerCase()}`,
    );
    setDisplayName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setPhone("");
    setRole("learner");
    setCreateOpen(false);
    await reload();
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (!resetFor || resetBusy) return;
    setResetBusy(true);
    setMsg(null);
    const res = await adminResetUserPassword(resetFor.id, resetPass);
    setResetBusy(false);
    if (!res.ok) {
      setMsg(res.message || "Reset failed");
      return;
    }
    setMsg(
      `Password reset for ${resetFor.display_name || resetFor.username || resetFor.id}`,
    );
    setResetFor(null);
    setResetPass("");
  }

  if (!ready || loading) {
    return (
      <div className="ops-page">
        <p className="ops-muted">Loading console…</p>
      </div>
    );
  }

  return (
    <div className="ops-page">
      <header className="ops-head">
        <div>
          <h1>Virtual Kuttab — Ops</h1>
          <p className="ops-muted">
            Signed in as {profile?.display_name || profile?.username || "admin"}
          </p>
        </div>
        <div className="ops-head-actions">
          <button
            type="button"
            className="ops-action"
            onClick={() => {
              setCreateOpen((v) => !v);
              setResetFor(null);
            }}
          >
            {createOpen ? "Close form" : "Create user"}
          </button>
          <button
            type="button"
            className="auth-guest-btn"
            style={{ width: "auto", paddingInline: "1.25rem" }}
            onClick={() =>
              void signOutLocal().then(() => router.replace(adminHref("login")))
            }
          >
            Sign out
          </button>
        </div>
      </header>

      {msg ? (
        <p className="auth-merge" role="status">
          {msg}
        </p>
      ) : null}

      {createOpen ? (
        <section className="ops-panel" aria-label="Create user">
          <h2 className="ops-section-title" style={{ marginTop: 0 }}>
            Create student or parent
          </h2>
          <form className="ops-form" onSubmit={(e) => void onCreate(e)}>
            <div className="ops-form-row">
              <label htmlFor="ops-role">Role</label>
              <select
                id="ops-role"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value === "parent" ? "parent" : "learner")
                }
              >
                <option value="learner">Student</option>
                <option value="parent">Parent</option>
              </select>
            </div>
            <div className="ops-form-row">
              <label htmlFor="ops-name">Display name</label>
              <input
                id="ops-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="ops-form-row">
              <label htmlFor="ops-user">Username</label>
              <input
                id="ops-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                pattern="[a-zA-Z0-9_]{3,24}"
                required
              />
            </div>
            <div className="ops-form-row">
              <label htmlFor="ops-email">Email</label>
              <input
                id="ops-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="ops-form-row">
              <label htmlFor="ops-phone">Phone (optional)</label>
              <input
                id="ops-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+9665…"
              />
            </div>
            <div className="ops-form-row">
              <label htmlFor="ops-pass">Password</label>
              <input
                id="ops-pass"
                type="text"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <button type="submit" className="auth-cta" disabled={createBusy}>
              {createBusy ? "Creating…" : "Create account"}
            </button>
          </form>
        </section>
      ) : null}

      {resetFor ? (
        <section className="ops-panel" aria-label="Reset password">
          <h2 className="ops-section-title" style={{ marginTop: 0 }}>
            Reset password — {resetFor.display_name || resetFor.username}
          </h2>
          <form className="ops-form" onSubmit={(e) => void onReset(e)}>
            <div className="ops-form-row">
              <label htmlFor="ops-reset-pass">New password</label>
              <input
                id="ops-reset-pass"
                type="text"
                autoComplete="new-password"
                value={resetPass}
                onChange={(e) => setResetPass(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="ops-form-actions">
              <button type="submit" className="auth-cta" disabled={resetBusy}>
                {resetBusy ? "Saving…" : "Save password"}
              </button>
              <button
                type="button"
                className="auth-guest-btn"
                onClick={() => {
                  setResetFor(null);
                  setResetPass("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="ops-stats" aria-label="Totals">
        <div className="ops-stat">
          <strong className="latin-num">{stats.total}</strong>
          <span>Users</span>
        </div>
        <div className="ops-stat">
          <strong className="latin-num">{stats.students}</strong>
          <span>Students</span>
        </div>
        <div className="ops-stat">
          <strong className="latin-num">{stats.parents}</strong>
          <span>Parents</span>
        </div>
        <div className="ops-stat">
          <strong className="latin-num">{stats.admins}</strong>
          <span>Admins</span>
        </div>
        <div className="ops-stat">
          <strong className="latin-num">{stats.disabled}</strong>
          <span>Disabled</span>
        </div>
        <div className="ops-stat">
          <strong className="latin-num">{stats.attempts}</strong>
          <span>Attempts</span>
        </div>
      </section>

      <div className="ops-filters" role="group" aria-label="Filter">
        {(
          [
            ["all", "All"],
            ["learner", "Students"],
            ["parent", "Parents"],
            ["admin", "Admins"],
            ["disabled", "Disabled"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? "ops-filter active" : "ops-filter"}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="ops-filter" onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <div className="ops-table-wrap">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Phone</th>
              <th>Locale</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={r.disabled ? "ops-row-disabled" : undefined}>
                <td>{r.display_name || "—"}</td>
                <td className="latin-num">{r.username ? `@${r.username}` : "—"}</td>
                <td>
                  <span
                    className={
                      r.role === "admin"
                        ? "ops-badge admin"
                        : r.role === "parent"
                          ? "ops-badge parent"
                          : "ops-badge"
                    }
                  >
                    {r.role === "learner" ? "student" : r.role}
                  </span>
                </td>
                <td>{r.disabled ? "disabled" : "active"}</td>
                <td className="latin-num">{r.phone_e164 || "—"}</td>
                <td>{r.locale}</td>
                <td className="latin-num">
                  {r.created_at
                    ? new Date(r.created_at).toISOString().slice(0, 10)
                    : "—"}
                </td>
                <td>
                  <div className="ops-row-actions">
                    {r.role !== "admin" && r.id !== profile?.id ? (
                      <>
                        <button
                          type="button"
                          className="ops-action"
                          disabled={busyId === r.id}
                          onClick={() => void toggleDisabled(r)}
                        >
                          {busyId === r.id
                            ? "…"
                            : r.disabled
                              ? "Enable"
                              : "Disable"}
                        </button>
                        <button
                          type="button"
                          className="ops-action"
                          onClick={() => {
                            setCreateOpen(false);
                            setResetFor(r);
                            setResetPass("");
                            setMsg(null);
                          }}
                        >
                          Reset PW
                        </button>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="ops-section-title">Recent rate-limit buckets</h2>
      <p className="ops-muted">
        Login ≤12 / 15m · Register ≤8 / 1h · Reset ≤5 / 1h (per identifier)
      </p>
      <div className="ops-table-wrap" style={{ marginTop: "0.75rem" }}>
        <table className="ops-table">
          <thead>
            <tr>
              <th>Bucket</th>
              <th>Hits</th>
              <th>Window start</th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 ? (
              <tr>
                <td colSpan={3}>No recent buckets</td>
              </tr>
            ) : (
              rates.map((r) => (
                <tr key={r.bucket}>
                  <td className="latin-num">{r.bucket}</td>
                  <td className="latin-num">{r.hit_count}</td>
                  <td className="latin-num">
                    {r.window_start
                      ? new Date(r.window_start).toISOString().replace("T", " ").slice(0, 19)
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
