/**
 * Smoke: verify super-admin can sign in. Prints ok/fail only (no password).
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "apps/web/package.json"));
const { createClient } = require("@supabase/supabase-js");

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
const env = {
  ...loadEnvFile(join(secretsDir, "virtual-kuttab.env")),
  ...loadEnvFile(join(root, ".env.local")),
  ...loadEnvFile(join(root, "apps/web/.env.local")),
  ...loadEnvFile(join(secretsDir, "vk-superadmin.credentials.env")),
};

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const email = env.VK_SUPERADMIN_EMAIL;
const password = env.VK_SUPERADMIN_PASSWORD;

if (!url || !anon || !email || !password) {
  console.log(JSON.stringify({ ok: false, reason: "missing_env" }));
  process.exit(1);
}

const client = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await client.auth.signInWithPassword({ email, password });
if (error || !data.session) {
  console.log(
    JSON.stringify({
      ok: false,
      reason: error?.message || "no_session",
      email,
    }),
  );
  process.exit(1);
}

const { data: prof } = await client
  .from("profiles")
  .select("role,username,disabled")
  .eq("id", data.user.id)
  .maybeSingle();

await client.auth.signOut();
console.log(
  JSON.stringify({
    ok: true,
    email,
    username: prof?.username,
    role: prof?.role,
    disabled: prof?.disabled,
  }),
);
