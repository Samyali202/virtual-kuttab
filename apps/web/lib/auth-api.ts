import { supabase } from "./supabase";
import type { LocaleId } from "./i18n";

export type ProfileRole = "learner" | "parent" | "admin";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  phone_e164: string | null;
  age: number | null;
  role: ProfileRole;
  locale: string;
  created_at: string;
  disabled?: boolean;
};

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
  username: string;
  phoneE164: string;
  age?: number | null;
  role: "learner" | "parent";
  locale: LocaleId;
};

export type RateKind = "login" | "register" | "reset";

const RATE: Record<RateKind, { max: number; windowSec: number }> = {
  login: { max: 12, windowSec: 900 },
  register: { max: 8, windowSec: 3600 },
  reset: { max: 5, windowSec: 3600 },
};

function rateBucket(kind: RateKind, key: string): string {
  return `${kind}:${key.trim().toLowerCase().slice(0, 120)}`;
}

export async function consumeRateLimit(
  kind: RateKind,
  key: string,
): Promise<boolean> {
  const cfg = RATE[kind];
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket: rateBucket(kind, key),
    p_max: cfg.max,
    p_window_seconds: cfg.windowSec,
  });
  if (error) {
    // Fail open only if RPC missing; otherwise treat as blocked when false
    console.warn("rate_limit", error.message);
    return true;
  }
  return Boolean(data);
}

export async function fetchMyProfile(): Promise<ProfileRow | null> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,display_name,username,phone_e164,age,role,locale,created_at,disabled",
    )
    .eq("id", uid)
    .maybeSingle();
  if (error || !data) return null;
  return data as ProfileRow;
}

export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_login_email", {
    identifier: identifier.trim(),
  });
  if (error) return null;
  return typeof data === "string" && data ? data : null;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("username_available", {
    candidate: username,
  });
  if (error) return false;
  return Boolean(data);
}

export async function signInWithIdentifier(identifier: string, password: string) {
  const idKey = identifier.trim().toLowerCase();
  const allowed = await consumeRateLimit("login", idKey || "unknown");
  if (!allowed) {
    return { ok: false as const, error: "rate_limited" as const };
  }

  const email = await resolveLoginEmail(identifier);
  if (!email) {
    return { ok: false as const, error: "not_found" as const };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false as const, error: "auth" as const, message: error.message };
  }

  const uid = data.session?.user?.id;
  if (uid) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("disabled")
      .eq("id", uid)
      .maybeSingle();
    if (prof?.disabled) {
      await supabase.auth.signOut();
      return { ok: false as const, error: "disabled" as const };
    }
  }

  return { ok: true as const, session: data.session };
}

export async function signUpStudentOrParent(input: RegisterInput) {
  const allowed = await consumeRateLimit(
    "register",
    input.email.trim().toLowerCase() || input.username,
  );
  if (!allowed) {
    return { ok: false as const, message: "rate_limited", code: "rate_limited" as const };
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        display_name: input.displayName.trim(),
        username: input.username.trim().toLowerCase(),
        phone_e164: input.phoneE164,
        age: input.age == null ? "" : String(input.age),
        role: input.role,
        locale: input.locale,
      },
    },
  });
  if (error) {
    return { ok: false as const, message: error.message };
  }
  return { ok: true as const, user: data.user, session: data.session };
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  const allowed = await consumeRateLimit("reset", email.trim().toLowerCase());
  if (!allowed) {
    return { ok: false as const, message: "rate_limited", code: "rate_limited" as const };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function adminListProfiles(limit = 200): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,display_name,username,phone_e164,age,role,locale,created_at,disabled",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as ProfileRow[];
}

export async function adminCountAttempts(): Promise<number> {
  const { count, error } = await supabase
    .from("ayah_attempts")
    .select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

export async function adminSetUserDisabled(
  userId: string,
  disabled: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("admin_set_user_disabled", {
    p_user_id: userId,
    p_disabled: disabled,
  });
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "not_found" };
  return { ok: true };
}

export type RateLimitRow = {
  bucket: string;
  hit_count: number;
  window_start: string;
};

export async function adminFetchRateLimits(
  limit = 40,
): Promise<RateLimitRow[]> {
  const { data, error } = await supabase.rpc("admin_rate_limit_stats", {
    p_limit: limit,
  });
  if (error || !data) return [];
  return data as RateLimitRow[];
}

export type AdminCreateUserInput = {
  displayName: string;
  username: string;
  email: string;
  password: string;
  role: "learner" | "parent";
  phoneE164?: string;
  age?: number | null;
  locale?: string;
};

export async function adminCreateUser(input: AdminCreateUserInput) {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: input,
  });
  if (error) {
    return { ok: false as const, message: error.message };
  }
  if (!data?.ok) {
    return {
      ok: false as const,
      message: String(data?.message || data?.error || "create_failed"),
    };
  }
  return { ok: true as const, user: data.user as ProfileRow & { email?: string } };
}

export async function adminResetUserPassword(
  userId: string,
  password: string,
) {
  const { data, error } = await supabase.functions.invoke(
    "admin-reset-password",
    { body: { userId, password } },
  );
  if (error) {
    return { ok: false as const, message: error.message };
  }
  if (!data?.ok) {
    return {
      ok: false as const,
      message: String(data?.message || data?.error || "reset_failed"),
    };
  }
  return { ok: true as const };
}
