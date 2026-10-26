# EveryAyah folders — required for Virtual Kuttab?

Product: Listen (**Husary Muallim only**) → Repeat → Recite → word-level feedback.  
**No Murattal / other qaris in the app.**

| Folder | Required? | Verdict |
|---|---|---|
| `Husary_Muallim_128kbps/` | **YES** | Core listen/repeat audio |
| `timings_files/` | **YES (partial)** | Needed for karaoke word highlight while listening |
| `QuranText_jpg/` | **NO** | Optional pictures of ayah text — we use Unicode text |
| `quranpngs/` | **NO** | Optional PNG ayah images — not used for ASR grading |

---

## 1. `timings_files/` — YES for Listen highlight

URL: https://everyayah.com/data/timings_files/

**What it is:** Per-reciter ZIP of word/split timing files so the UI can highlight words as audio plays.

**Correct file for Husary:**  
`https://everyayah.com/data/timings_files/Husary_Timings.zip` (~35 KB) — already downloaded under `content/timings/`.

**Disclaimer (upstream):** must link back to VerseByVerseQuran / EveryAyah; timings are “as-is” and may drift because MP3s were fixed after splitting.

### Important gap
There is **no** `Husary_Muallim_Timings.zip` (404).  
`Husary_Timings.zip` matches **Husary Murattal**, not Muallim.

| Approach | Recommendation |
|---|---|
| v1 quick | Use ayah-level highlight only, or approximate with `Husary_Timings` knowing sync won’t be perfect on Muallim |
| Better | Get word timings from **QUL Husary** pack or generate with **quran-align** against Muallim MP3s |
| Later | Ship normalized `timings/muallim/*.json` as SSoT |

---

## 2. `QuranText_jpg/` — NOT required

URL: https://everyayah.com/data/QuranText_jpg/

**What it is:** JPEG images of each ayah, named `{surah}_{ayah}.jpg` (e.g. `1_1.jpg`, `100_1.jpg`).

**Why skip for core product:**
- Grading needs **text**, not images (ASR → Levenshtein vs Tanzil).
- UI should render Unicode mushaf text (searchable, colorable green/red).
- Images can’t drive word-level mistake coloring cleanly.

**Optional later:** decorative “ayah card” thumbnails only.

---

## 3. `quranpngs/` — NOT required

URL: https://everyayah.com/data/quranpngs/

**What it is:** PNG ayah images; naming like `1_1.png` (not `001001.png`). Full zip: `000_images.zip` (~77 MB). Similar set also under `images_png/`.

**Same verdict as JPG:** skip for v1. Use text UI.

---

## Required vs optional summary

### Must have
1. **Husary Muallim MP3s** — `Husary_Muallim_128kbps/`  
2. **Quran text (Unicode)** — Tanzil / our `content/tanzil` (not JPG/PNG)  
3. **Some timings** — for Listen word highlight (Husary timings now; Muallim-aligned later)

### Nice later (not blocking)
- `QuranText_jpg/` or `quranpngs/` for pretty cards  
- Full Muallim-aligned timings (QUL / quran-align)

### Do not use as grading source
- JPG / PNG ayah images
