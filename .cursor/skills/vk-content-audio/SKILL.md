---
name: vk-content-audio
description: >-
  Manage Virtual Kuttab Quran text, Husary audio, and word timings content
  pipeline. Use when seeding content/, R2 uploads, Tanzil orthography,
  timings, or listen/repeat media.
---

# VK Content & Audio

## On-disk layout

```
content/
  tanzil/quran.json
  audio/husary_muallim_sample/   # PRODUCT samples (Muallim only)
  audio/husary_sample/           # NOT product (old Murattal — ignore)
  audio/HUSARY_MUALLIM_MANIFEST.md
  timings/cpfair/Husary_Muallim_128kbps.json   # Listen karaoke SSoT
  timings/ATTRIBUTION.md
```

## Sources (production) — Husary Muallim ONLY

| Asset | Source | Action |
|---|---|---|
| Text | Tanzil Uthmani / quran-json | Pin `content_version`; attribute Tanzil |
| **Audio (only)** | EveryAyah `Husary_Muallim_128kbps` or HF `maqra-project/mahmoud-al-husary-muallim-128kbps` | Download → **Cloudflare R2** |
| **Listen timings (SSoT)** | **cpfair/quran-align** `Husary_Muallim_128kbps.json` (CC BY 4.0) | `python scripts/import_cpfair_muallim_timings.py` → Supabase |

## Rules

1. **Never hotlink** everyayah.com or audio-cdn.tarteel.ai in production.  
2. During recite, read text from **local DB/SSoT**, not live APIs.  
3. Listen mode uses **real Husary MP3** — never TTS the ayah.  
4. Timing files drive word highlight while audio plays.  
5. Full mushaf audio is large (~2GB+); keep samples in repo, full set on R2.  
6. **Do not** invent Listen karaoke with energy VAD or ASR-tiny. ASR is for Recite scoring only.  
7. Do not use Murattal `Husary_Timings.zip` as Muallim truth.

## Timings note

cpfair segment shape: `[word_start, word_end, start_msec, end_msec]` (Tanzil space-split).  
Importer expands to VK:

```json
{
  "source": "cpfair-quran-align",
  "content_version": "cpfair-2016-11-24",
  "speech_end": 14.06,
  "words": [{"i": 0, "start": 0.33, "end": 5.0}],
  "quiet_gaps": [{"start": 5.0, "end": 8.55}],
  "replays": []
}
```

Pilot: `--surah 10 --ayahs 1-5`. Full mushaf: `--all`.
