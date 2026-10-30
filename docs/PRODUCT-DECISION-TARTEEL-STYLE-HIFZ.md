# Product Decision — Tarteel-Style Hifz (NO Tajweed Scoring)
*Locked: 2026-10-26*

## Your product in one sentence
Learner listens to **only Husary Muallim** (Mahmoud Khalil Al-Husary teaching style), may **repeat after him**, then **recites**; the app checks **word-level** mistakes only (like Tarteel) and says **well done** or **points to wrong/missing words**.

**Audio lock:** **Husary Muallim 128kbps only** — no Murattal, Mujawwad, Alafasy, or other qaris in the product.

**Out of scope for v1:** tajweed rules, phoneme sifat, LiveKit, Rive, LLM fatwa.

**Hifz unit (locked 2026-10-30):** **ayah-by-ayah** only. One ayah = one Listen → Repeat → Recite → feedback cycle. Do **not** present a whole mushaf page / multi-ayah block as the core memorization loop. A later optional **maintenance** mode may show a whole page for review-only users — not v1.

---

## Exact user flow

```
1. Pick Surah / Ayah (or Hifz range) — one ayah at a time
2. [Listen]  → play Husary MP3 + highlight words as he speaks
3. [Repeat]  → optional: play ayah (or word-by-word), learner shadows
4. [Recite]  → learner records ayah into mic
5. App ASR → compares to FIXED reference text of that ayah
6. UI: green words OK · amber/red wrong/missing · "أحسنت" if clean
7. Save attempt to progress (maintain / Hifz tracker)
8. Advance to next ayah (or redo mistakes on this ayah)
```

Important: comparison is **learner speech vs expected ayah TEXT** (via ASR),  
not audio-fingerprint vs the Husary MP3. The MP3 is the **teacher to listen to**;  
the text is the **ground truth to grade against**.

---

## Exact stack to use (locked)

| Need | Exact choice | Why |
|---|---|---|
| **Web app** | **Next.js 15** (App Router) + TypeScript | Fastest path to a simple site |
| **Mobile later** | Expo (same TS) | After web loop works |
| **Quran text** | **Tanzil Uthmani** offline JSON (seed into DB) | Stable reference; no live API during recite |
| **Optional SDK seed** | `@quranjs/api` **admin-only** once | Not in hot path |
| **Sheikh audio (ONLY)** | **EveryAyah `Husary_Muallim_128kbps`** | Teaching style for listen/repeat; `SSSAAA.mp3` (6236 files) |
| **Verified mirror** | `maqra-project/mahmoud-al-husary-muallim-128kbps` on HF | Same set + checksums |
| **Full pack download** | `…/Husary_Muallim_128kbps/000_versebyverse.zip` (~2 GB) | Preferred bulk download → R2 |
| **Word timings (listen highlight)** | Generate/align for **Muallim** (quran-align / QUL if available); do not rely on Murattal `Husary_Timings.zip` as truth | No official `Husary_Muallim_Timings.zip` on EveryAyah |
| **Audio hosting** | **Cloudflare R2** | Zero egress; never hotlink everyayah/tarteel CDN in production |
| **Database / auth / progress** | **Supabase** (Postgres + Auth + RLS) | Parent/user accounts + Hifz metrics |
| **ASR (Tarteel-like words)** | **`Abdou/quran-asr-tiny`** via **`sherpa-onnx`** | MIT, small, Quran-trained, no LM auto-correct |
| **Runtime (web)** | `sherpa-onnx` WASM **or** small FastAPI scoring API | Start with **server FastAPI** for simplicity; move on-device later |
| **Align / mistakes** | Word **Levenshtein** (deletion / substitution / insertion) | Same class of feedback as Tarteel word mistakes |
| **Virtual Sheikh feedback** | Templates + highlight UI + short Piper clips (`أحسنت`, `أعد هذه الكلمة`) | No LLM needed |
| **Avatar v1** | Static Sheikh image + word colors | Enough for the flow you described |

### Do NOT use in v1
- Any reciter except **Husary Muallim** (no Murattal / Mujawwad / other qaris)  
- Tajweed / muaalem sifat scoring  
- LiveKit  
- Rive / three-vrm  
- Whisper-large as primary judge  
- NPL Zipformer as paid engine (OK only if app stays free forever — prefer MIT tiny)  
- Live `@quranjs` calls during recite  
- `QuranText_jpg/` / `quranpngs/` as grading source  

---

## Concrete URLs / packages

```text
# Audio — Husary Muallim ONLY
https://everyayah.com/data/Husary_Muallim_128kbps/001001.mp3
https://everyayah.com/data/Husary_Muallim_128kbps/000_versebyverse.zip
https://everyayah.com/data/Husary_Muallim_128kbps/000_checksum.md5
https://huggingface.co/datasets/maqra-project/mahmoud-al-husary-muallim-128kbps

# ASR
https://huggingface.co/Abdou/quran-asr-tiny
pip: sherpa-onnx

# App
next, @supabase/supabase-js, zod
pip: fastapi, uvicorn, sherpa-onnx, numpy, soundfile
```

---

## How grading works (simple & real)

```
Reference (ayah 1:2):  الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ
ASR hypothesis:        الحمد لله رب العالمين   (normalized)

Normalize both (strip/unify harakat policy — pick ONE and stick to it).
Tokenize words → edit distance:

  match / substitution / deletion / insertion

UI maps each reference word index → OK | WRONG | MISSING
If zero errors → "أحسنت، بارك الله فيك"
Else → highlight first 1–2 mistakes + replay Husary for that word
```

**You are NOT matching waveforms to Husary MP3.**  
You match **what the learner said (ASR text)** to **what the ayah should be (Tanzil text)**.  
Husary is only the listening teacher.

---

## Minimal services to run

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Next.js UI  │────►│ Supabase     │     │ Cloudflare R2   │
│ Listen/     │     │ users,       │     │ Husary MP3s     │
│ Repeat/     │     │ ayah_attempts│     │ + timings JSON  │
│ Recite      │     └──────────────┘     └─────────────────┘
└──────┬──────┘
       │ upload wav / or stream short PCM
       ▼
┌──────────────────┐
│ FastAPI          │
│ sherpa-onnx      │
│ quran-asr-tiny   │
│ align → JSON     │
└──────────────────┘
```

Cost to start: Supabase free/pro + R2 + one small VPS for ASR — **Hetzner CX23** @ Nuremberg (2 vCPU / 4 GB, ~€6/mo; keep running).

---

## Build order (do this, in order)

1. **Content** — Import Tanzil ayat + **Husary Muallim only** MP3s into R2 + Supabase; build Muallim-aligned timings  
2. **Listen UI** — Play Muallim ayah, highlight words  
3. **Repeat UI** — Same player; optional pause between ayahs  
4. **Recite** — Record → FastAPI ASR → word diff → green/red UI + “أحسنت”  
5. **Progress** — Save attempts (maintain / Hifz streak)  
6. Later — Expo app; on-device ASR; nicer Sheikh face  

---

## Success criteria (your idea is live when)

- [ ] User can listen to Husary for any ayah with word highlight  
- [ ] User can record an ayah and see which **words** were wrong/missing  
- [ ] Clean recitation shows a clear **well done**  
- [ ] No tajweed scoring anywhere  
- [ ] Works on phone browser (PWA) with simple UI  

---

## Decision summary (say this out loud)

> We build a **Tarteel-like Hifz web app**: **Husary Muallim only** for listen/repeat, **quran-asr-tiny + sherpa-onnx for word mistakes**, **Supabase + R2**, **Next.js**. No other qaris. No tajweed. No LiveKit.
