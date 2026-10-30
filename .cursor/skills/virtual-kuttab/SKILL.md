---
name: virtual-kuttab
description: >-
  Core product rules for Virtual Kuttab — Tarteel-style Quran Hifz platform
  (listen Husary → repeat → recite → word-level feedback, no tajweed). Use when
  building features, choosing libraries, reviewing architecture, or implementing
  Listen/Repeat/Recite/score flows in this repo.
---

# Virtual Kuttab — Core Skill

## Product (locked)

Learner **listens** to **Husary Muallim only** (Mahmoud Khalil Al-Husary teaching style), may **repeat**, then **recites**. App grades **word-level** mistakes only (like Tarteel). No tajweed scoring in v1. **No other reciters.**

**Hifz unit:** **ayah-by-ayah** (not whole-page mushaf). Whole-page review = Later maintenance feature only.

Canonical docs (read these first):

- `docs/PRODUCT-DECISION-TARTEEL-STYLE-HIFZ.md`
- `docs/BULLETPROOF-ARCHITECTURE-VERDICT.md`
- `docs/learned/INVENTORY.md`

## Exact stack

| Layer | Use |
|---|---|
| Web | Next.js + TypeScript (`apps/web`) |
| ASR API | FastAPI + sherpa-onnx (`services/asr`) |
| Model | `models/quran-asr-tiny` (MIT) |
| Text | Tanzil / `content/tanzil` — pinned, not live API during recite |
| Audio | **Husary Muallim only** — samples in `content/audio/husary_muallim_sample`; full set → R2 |
| Timings | Build for Muallim (Murattal `Husary_Timings` is not authoritative) |
| DB | Supabase (Auth + Postgres + RLS) |
| Feedback | Word highlight + templates (“أحسنت”) |

## Forbidden in v1

- Tajweed / muaalem sifat auto-scoring  
- LiveKit for core loop  
- three-vrm / heavy 3D  
- Whisper-large as primary judge  
- Live `@quranjs` during recite  
- Comparing waveform to Husary MP3 (grade vs **text**, not vs audio fingerprint)

## Grading rule

```
ASR hypothesis  vs  pinned ayah text
→ normalize → word Levenshtein
→ deletion | substitution | insertion
→ UI green/red + message_ar
```

Aligner: `services/asr/align.py` · API: `POST /score`

## Avatar

Allowed: static Sheikh now; **Rive later**. Avatar never invents corrections — only presents ASR/align results.

## When implementing

1. Prefer simple UI and word feedback over new ML.  
2. Silence / “أعد” on bad audio — never invent errors.  
3. Cap corrections (1–2 words) per turn.  
4. Keep Husary as listen teacher only.  
5. Update `docs/learned/` if you discover new facts.
