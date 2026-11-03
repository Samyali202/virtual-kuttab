/**
 * Diagnose ops admin login. Prints reasons only — never prints password.
 * Optionally resets password into vk-superadmin.credentials.env when --reset.
 *
 * Usage:
 *   node scripts/smoke-fix-admin-login.mjs
 *   node scripts/smoke-fix-admin-login.mjs --reset
 */
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "apps/web/package.json"));
const { createClient } = require("@supabase/supabase-js");
const doReset = process.argv.includes("--reset");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const secretsDir = join(
  homedir(),
  "AppData/Local/Cursor/AgentStores/cursor_agent_stores/u401644335/files/secrets",
);
const credPath = join(secretsDir, "vk-superadmin.credentials.env");
const env = {
  ...loadEnvFile(join(secretsDir, "virtual-kuttab.env")),
  ...loadEnvFile(join(root, ".env.local")),
  ...loadEnvFile(join(root, "apps/web/.env.local")),
  ...loadEnvFile(credPath),
};

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const email = (env.VK_SUPERADMIN_EMAIL || "vk.ops.admin@masar360.local").trim();
const password = env.VK_SUPERADMIN_PASSWORD || "";

if (!url || !anon || !service) {
  console.log(JSON.stringify({ ok: false, reason: "missing_supabase_env" }));
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const client = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const user = (list?.users || []).find(
  (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
);

const { data: resolved, error: resolveErr } = await client.rpc(
  "resolve_login_email",
  { identifier: email },
);
const { data: resolvedUser } = await client.rpc("resolve_login_email", {
  identifier: "vkopsadmin",
});

const { data: prof } = user
  ? await admin
      .from("profiles")
      .select("id,username,role,disabled,display_name")
      .eq("id", user.id)
      .maybeSingle()
  : { data: null };

let signIn = { ok: false, reason: "skipped_no_password" };
if (password) {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  signIn = {
    ok: Boolean(data?.session) && !error,
    reason: error?.message || (data?.session ? null : "no_session"),
  };
  if (data?.session) await client.auth.signOut();
}

let reset = null;
if (doReset && user) {
  const next = `Vk!${randomBytes(12).toString("base64url")}`;
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: next,
    email_confirm: true,
  });
  if (error) {
    reset = { ok: false, reason: error.message };
  } else {
    const body = `# Virtual Kuttab super-admin — reset ${new Date().toISOString()}
# Keep private. Open /vk-ops-console/login (not /login).
VK_SUPERADMIN_EMAIL=${email}
VK_SUPERADMIN_USERNAME=${prof?.username || "vkopsadmin"}
VK_SUPERADMIN_PASSWORD=${next}
VK_ADMIN_PATH=/vk-ops-console
`;
    writeFileSync(credPath, body, "utf8");
    const verify = await client.auth.signInWithPassword({
      email,
      password: next,
    });
    if (verify.data?.session) await client.auth.signOut();
    reset = {
      ok: Boolean(verify.data?.session) && !verify.error,
      credsFile: credPath,
      verifyReason: verify.error?.message || null,
    };
  }
}

console.log(
  JSON.stringify(
    {
      email,
      userFound: Boolean(user),
      userId: user?.id || null,
      confirmed: Boolean(user?.email_confirmed_at),
      profile: prof,
      resolveEmail: { value: resolved, error: resolveErr?.message || null },
      resolveUsername: { value: resolvedUser },
      storedPasswordSignIn: signIn,
      reset,
    },
    null,
    2,
  ),
);
