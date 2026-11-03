/**
 * Apply a SQL migration via Supabase Management API (database query).
 * Usage: node scripts/apply-sql-migration.mjs supabase/migrations/FILE.sql
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const storeEnv = join(
  homedir(),
  "AppData/Local/Cursor/AgentStores/cursor_agent_stores/u401644335/files/secrets/virtual-kuttab.env",
);

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

const env = { ...loadEnvFile(storeEnv), ...loadEnvFile(join(root, ".env.local")) };
const token = env.SUPABASE_ACCESS_TOKEN;
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
const file = process.argv[2];
if (!token || !ref || !file) {
  console.error("Need SUPABASE_ACCESS_TOKEN, NEXT_PUBLIC_SUPABASE_URL, and SQL file path");
  process.exit(1);
}
const sqlPath = resolve(root, file);
const sql = readFileSync(sqlPath, "utf8");

const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`;
const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
if (!res.ok) {
  console.error("Migration failed", res.status, text.slice(0, 800));
  process.exit(1);
}
console.log("Migration applied:", file);
console.log(text.slice(0, 400));
