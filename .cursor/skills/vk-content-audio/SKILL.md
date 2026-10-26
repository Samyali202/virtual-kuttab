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
```

## Sources (production) — Husary Muallim ONLY

| Asset | Source | Action |
|---|---|---|
| Text | Tanzil Uthmani / quran-json | Pin `content_version`; attribute Tanzil |
| **Audio (only)** | EveryAyah `Husary_Muallim_128kbps` or HF `maqra-project/mahmoud-al-husary-muallim-128kbps` | Download → **Cloudflare R2** |
| Timings | Align to **Muallim** MP3s (no official Muallim timings zip on EveryAyah) | quran-align / QUL / custom JSON |

## Rules

1. **Never hotlink** everyayah.com or audio-cdn.tarteel.ai in production.  
2. During recite, read text from **local DB/SSoT**, not live APIs.  
3. Listen mode uses **real Husary MP3** — never TTS the ayah.  
4. Timing files drive word highlight while audio plays.  
5. Full mushaf audio is large (~2GB+); keep samples in repo, full set on R2.

## Timings note

EveryAyah timing `.txt` formats vary by surah file. Normalize into:

```json
{ "surah": 1, "ayah": 1, "words": [{"i":0, "start_ms":0, "end_ms":630}] }
```

Store normalized JSON in Supabase or `content/timings/normalized/`.
