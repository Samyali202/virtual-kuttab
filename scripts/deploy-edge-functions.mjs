/**
 * Deploy Stage 2 Edge Functions via Supabase Management API / CLI.
 * Usage: node scripts/deploy-edge-functions.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
    out[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
  return out;
}

const env = { ...loadEnvFile(storeEnv), ...loadEnvFile(join(root, ".env.local")) };
const token = env.SUPABASE_ACCESS_TOKEN;
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
if (!token || !ref) {
  console.error("Need SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const fnsDir = join(root, "supabase/functions");
const names = readdirSync(fnsDir).filter((n) =>
  statSync(join(fnsDir, n)).isDirectory(),
);

process.env.SUPABASE_ACCESS_TOKEN = token;
for (const name of names) {
  console.log("Deploying", name, "…");
  const r = spawnSync(
    "npx",
    [
      "--yes",
      "supabase@3.0.0",
      "functions",
      "deploy",
      name,
      "--project-ref",
      ref,
      "--yes",
    ],
    {
      cwd: root,
      env: process.env,
      encoding: "utf8",
      shell: true,
    },
  );
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.error(r.stderr);
  if (r.status !== 0) {
    console.error("Failed deploying", name);
    process.exit(r.status || 1);
  }
}
console.log("Edge functions deployed:", names.join(", "));
