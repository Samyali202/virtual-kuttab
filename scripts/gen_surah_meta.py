import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
q = json.loads((ROOT / "content" / "tanzil" / "quran.json").read_text(encoding="utf-8"))
out = ROOT / "apps" / "web" / "lib" / "surah-meta.ts"
lines = [
    "/** Auto-generated from content/tanzil/quran.json — do not edit by hand. */",
    "export const SURAH_META: Record<number, { ar: string; en: string }> = {",
]
for su in q:
    sid = int(su["id"])
    ar = su["name"].replace("\\", "\\\\").replace("'", "\\'")
    en = su["transliteration"].replace("\\", "\\\\").replace("'", "\\'")
    lines.append(f"  {sid}: {{ ar: '{ar}', en: '{en}' }},")
lines.append("};")
lines.append("")
out.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {out} ({len(q)} surahs)")
