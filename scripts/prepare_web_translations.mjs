/**
 * Build slim translation JSON for the web app from Tanzil text files.
 * Sources: content/tanzil/translations/*.txt
 * Strips Tanzil [[footnote]] blocks for cleaner UI.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(root, "content/tanzil/translations");
const outDir = path.join(root, "apps/web/public/translations");

const IDS = [
  "en.sahih",
  "ru.kuliev",
  "es.garcia",
  "de.bubenheim",
  "fr.hamidullah",
  "ur.maududi",
];

fs.mkdirSync(outDir, { recursive: true });

function stripFootnotes(s) {
  return s
    .replace(/\[\[[\s\S]*?\]\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function convert(id) {
  const file = path.join(srcDir, `${id}.txt`);
  if (!fs.existsSync(file)) {
    console.error(`missing ${file}`);
    process.exit(1);
  }
  const text = fs.readFileSync(file, "utf8");
  const out = {};
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i1 = line.indexOf("|");
    const i2 = line.indexOf("|", i1 + 1);
    if (i1 < 0 || i2 < 0) continue;
    const s = Number(line.slice(0, i1));
    const a = Number(line.slice(i1 + 1, i2));
    if (!Number.isFinite(s) || !Number.isFinite(a)) continue;
    out[`${s}:${a}`] = stripFootnotes(line.slice(i2 + 1));
    n += 1;
  }
  const dest = path.join(outDir, `${id}.json`);
  fs.writeFileSync(dest, JSON.stringify(out));
  // Also keep a content-side JSON snapshot for tooling.
  const contentJson = path.join(srcDir, `${id}.json`);
  fs.writeFileSync(contentJson, JSON.stringify(out));
  const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
  console.log(`${id}: ${n} ayahs → ${dest} (${mb} MB)`);
}

for (const id of IDS) convert(id);
