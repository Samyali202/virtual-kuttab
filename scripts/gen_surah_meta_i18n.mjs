/**
 * Merge Arabic/English surah-meta with verified Russian names from
 * quran-center/quran-meta (src/i18n/surah.ru.ts).
 * Source: https://github.com/quran-center/quran-meta/blob/master/src/i18n/surah.ru.ts
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ruSrc = fs.readFileSync(
  path.join(root, "content/tanzil/surah.ru.source.ts"),
  "utf8",
);
const existing = fs.readFileSync(
  path.join(root, "apps/web/lib/surah-meta.ts"),
  "utf8",
);

const ruPairs = [...ruSrc.matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)].map(
  (m) => ({ name: m[1], meaning: m[2] }),
);
if (ruPairs.length !== 114) {
  console.error("Expected 114 Russian surah names, got", ruPairs.length);
  process.exit(1);
}

const enMap = new Map();
for (const m of existing.matchAll(
  /(\d+):\s*\{\s*ar:\s*'((?:\\'|[^'])*)',\s*en:\s*'((?:\\'|[^'])*)'\s*\}/g,
)) {
  enMap.set(Number(m[1]), {
    ar: m[2].replace(/\\'/g, "'"),
    en: m[3].replace(/\\'/g, "'"),
  });
}
if (enMap.size !== 114) {
  console.error("Expected 114 EN/AR entries, got", enMap.size);
  process.exit(1);
}

function q(s) {
  return `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

const lines = [
  "/** Auto-generated — Arabic/English from Tanzil quran.json; Russian names from quran-center/quran-meta surah.ru.ts. Do not invent names. */",
  "export type SurahMeta = { ar: string; en: string; ru: string };",
  "export const SURAH_META: Record<number, SurahMeta> = {",
];
for (let i = 1; i <= 114; i++) {
  const base = enMap.get(i);
  const ru = ruPairs[i - 1].name;
  lines.push(
    `  ${i}: { ar: ${q(base.ar)}, en: ${q(base.en)}, ru: ${q(ru)} },`,
  );
}
lines.push("};");
lines.push("");
lines.push(
  "export function surahName(id: number, locale: 'ar' | 'en' | 'ru'): string {",
);
lines.push("  const m = SURAH_META[id];");
lines.push("  if (!m) return String(id);");
lines.push("  if (locale === 'en') return m.en;");
lines.push("  if (locale === 'ru') return m.ru;");
lines.push("  return m.ar;");
lines.push("}");
lines.push("");

const out = path.join(root, "apps/web/lib/surah-meta.ts");
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log("Wrote", out);

// Also write a compact JSON index for translations later (ayah keyed).
function parseTanzilTxt(file) {
  const text = fs.readFileSync(file, "utf8");
  const outObj = {};
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i1 = line.indexOf("|");
    const i2 = line.indexOf("|", i1 + 1);
    if (i1 < 0 || i2 < 0) continue;
    const s = Number(line.slice(0, i1));
    const a = Number(line.slice(i1 + 1, i2));
    const t = line.slice(i2 + 1);
    if (!Number.isFinite(s) || !Number.isFinite(a)) continue;
    outObj[`${s}:${a}`] = t;
    count += 1;
  }
  return { outObj, count };
}

const en = parseTanzilTxt(
  path.join(root, "content/tanzil/translations/en.sahih.txt"),
);
const ru = parseTanzilTxt(
  path.join(root, "content/tanzil/translations/ru.kuliev.txt"),
);
fs.writeFileSync(
  path.join(root, "content/tanzil/translations/en.sahih.json"),
  JSON.stringify(en.outObj),
);
fs.writeFileSync(
  path.join(root, "content/tanzil/translations/ru.muntahab.json"),
  JSON.stringify(ru.outObj),
);
console.log("en.sahih ayahs", en.count, "ru.kuliev ayahs", ru.count);
