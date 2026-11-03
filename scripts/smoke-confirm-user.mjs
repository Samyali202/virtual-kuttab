/**
 * One-off smoke helper: find + email-confirm a test user. Does not print secrets.
 * Usage: node scripts/smoke-confirm-user.mjs smoke.student.1103a@gmail.com
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

const storeEnv = join(
  homedir(),
  "AppData/Local/Cursor/AgentStores/cursor_agent_stores/u401644335/files/secrets/virtual-kuttab.env",
);
const env = {
  ...loadEnvFile(storeEnv),
  ...loadEnvFile(join(root, ".env.local")),
  ...loadEnvFile(join(root, "apps/web/.env.local")),
};

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/smoke-confirm-user.mjs <email>");
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase URL or service role key");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: list, error: listErr } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listErr) {
  console.error("listUsers", listErr.message);
  process.exit(1);
}

const u = (list?.users || []).find((x) => x.email === email);
if (!u) {
  console.log(JSON.stringify({ found: false, email }));
  process.exit(2);
}

let confirmed = Boolean(u.email_confirmed_at);
if (!confirmed) {
  const { error } = await admin.auth.admin.updateUserById(u.id, {
    email_confirm: true,
  });
  if (error) {
    console.error("confirm failed", error.message);
    process.exit(1);
  }
  confirmed = true;
}

const { data: prof } = await admin
  .from("profiles")
  .select("id,username,role,disabled,display_name")
  .eq("id", u.id)
  .maybeSingle();

console.log(
  JSON.stringify(
    {
      found: true,
      id: u.id,
      confirmed,
      created: u.created_at,
      profile: prof,
    },
    null,
    2,
  ),
);
