/**
 * Smoke helper: create a confirmed parent via service role (bypasses signup email limits).
 * Usage: node scripts/smoke-create-parent.mjs
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

const env = {
  ...loadEnvFile(
    join(
      homedir(),
      "AppData/Local/Cursor/AgentStores/cursor_agent_stores/u401644335/files/secrets/virtual-kuttab.env",
    ),
  ),
  ...loadEnvFile(join(root, ".env.local")),
  ...loadEnvFile(join(root, "apps/web/.env.local")),
};

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = "smoke.parent.1103b@gmail.com";
const password = "SmokeTest!1103a";
const username = "smoke_p1103b";

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: {
    display_name: "Smoke Parent",
    username,
    phone_e164: "+966501103003",
    role: "parent",
    locale: "ar",
  },
});
if (error) {
  console.error("createUser", error.message);
  process.exit(1);
}

// Ensure profile role/username (trigger may have set from metadata)
await admin
  .from("profiles")
  .update({
    role: "parent",
    username,
    display_name: "Smoke Parent",
    phone_e164: "+966501103003",
  })
  .eq("id", data.user.id);

const { data: prof } = await admin
  .from("profiles")
  .select("id,username,role,display_name")
  .eq("id", data.user.id)
  .maybeSingle();

console.log(
  JSON.stringify(
    { ok: true, email, username, profile: prof },
    null,
    2,
  ),
);
