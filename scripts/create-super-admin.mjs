/**
 * Create / promote Virtual Kuttab super-admin.
 * Loads secrets from user store or repo .env.local — never prints the password.
 *
 * Usage: node scripts/create-super-admin.mjs
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
const storeEnv = join(
  homedir(),
  "AppData/Local/Cursor/AgentStores/cursor_agent_stores/u401644335/files/secrets/virtual-kuttab.env",
);
const repoEnv = join(root, ".env.local");
const outCreds = join(
  homedir(),
  "AppData/Local/Cursor/AgentStores/cursor_agent_stores/u401644335/files/secrets/vk-superadmin.credentials.env",
);

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

const env = { ...loadEnvFile(storeEnv), ...loadEnvFile(repoEnv) };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const email =
  env.VK_SUPERADMIN_EMAIL?.trim() || "vk.ops.admin@masar360.local";
const username = env.VK_SUPERADMIN_USERNAME?.trim() || "vkopsadmin";
const password =
  env.VK_SUPERADMIN_PASSWORD?.trim() ||
  `Vk!${randomBytes(12).toString("base64url")}`;

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  let userId = null;

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) throw listed.error;
  const existing = listed.data.users.find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
  );

  if (existing) {
    userId = existing.id;
    const upd = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: {
        display_name: "Super Admin",
        username,
        role: "admin",
      },
    });
    if (upd.error) throw upd.error;
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: "Super Admin",
        username,
        role: "admin",
        phone_e164: "+966500000000",
      },
    });
    if (created.error) throw created.error;
    userId = created.data.user.id;
  }

  // Force admin role (trigger strips admin on public signup; service role upsert OK)
  const { error: upErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      display_name: "Super Admin",
      username,
      role: "admin",
      locale: "ar",
      phone_e164: "+966500000000",
    },
    { onConflict: "id" },
  );
  if (upErr) throw upErr;

  const body = [
    `# Virtual Kuttab super-admin — generated ${new Date().toISOString()}`,
    `# Keep private. Open /vk-ops-console/login (not /login).`,
    `VK_SUPERADMIN_EMAIL=${email}`,
    `VK_SUPERADMIN_USERNAME=${username}`,
    `VK_SUPERADMIN_PASSWORD=${password}`,
    `VK_ADMIN_PATH=/vk-ops-console`,
    "",
  ].join("\n");
  writeFileSync(outCreds, body, { encoding: "utf8", mode: 0o600 });

  // Mirror keys into store env without printing secrets
  if (existsSync(storeEnv)) {
    let raw = readFileSync(storeEnv, "utf8");
    for (const [k, v] of [
      ["VK_SUPERADMIN_EMAIL", email],
      ["VK_SUPERADMIN_USERNAME", username],
      ["VK_ADMIN_PATH", "/vk-ops-console"],
    ]) {
      const re = new RegExp(`^${k}=.*$`, "m");
      if (re.test(raw)) raw = raw.replace(re, `${k}=${v}`);
      else raw += `\n${k}=${v}`;
    }
    // password only in credentials file
    writeFileSync(storeEnv, raw.endsWith("\n") ? raw : raw + "\n");
  }

  console.log("Super-admin ready.");
  console.log(`Email/username written; password saved ONLY to:`);
  console.log(outCreds);
  console.log("Admin login URL path: /vk-ops-console/login");
  console.log("Student/parent login remains: /login");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
