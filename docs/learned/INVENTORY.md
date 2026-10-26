# Learned Inventory — Virtual Kuttab Workspace
*Studied: 2026-10-26*

## Project decisions (authoritative)

| Doc | Takeaway |
|---|---|
| `PRODUCT-DECISION-TARTEEL-STYLE-HIFZ.md` | Product = listen Husary → recite → **word** feedback only |
| `BULLETPROOF-ARCHITECTURE-VERDICT.md` | Precision-first; defer LiveKit/Rive/LLM/tajweed |
| `architecture-validation-review.md` | Rive preferred over VRM; R2; SSoT content |
| `virtual-kuttab-full-scope-research.md` | Broad OSS map (partially superseded for v1) |
| `virtual-kuttab-architecture-report.md` | Early ASR deep dive (Zipformer/NPL caveats) |

## Downloaded / cloned assets

| Path | What | License note |
|---|---|---|
| `models/quran-asr-tiny/` | MIT ONNX int8 ASR (~19MB) + tokens + spelling | Safe for commercial path |
| `content/audio/husary_sample/` | Al-Fatihah 1:1–1:7 Husary MP3 | EveryAyah terms — attribute; self-host prod |
| `content/timings/husary/` | Per-surah timing txt from Husary_Timings.zip | Link-back request from EveryAyah disclaimer |
| `content/tanzil/quran.json` | Full text seed via quran-json CDN | CC BY-SA isolate; prefer Tanzil CC-BY for prod SSoT |
| `vendor/hifz-tester` | Word-level Hifz UI reference | MIT |
| `vendor/tilawa` | Offline verse tracking | Code MIT; Zipformer NPL |
| `vendor/quran-align` | Word timestamp tooling | CC BY 4.0 data |
| `vendor/mahfuz` | Kids curriculum / games reference | MIT |
| `vendor/quran-json` | Static Quran JSON (if clone finished) | CC BY-SA |

## Code we added

| Path | Role |
|---|---|
| `services/asr/align.py` | Word Levenshtein + ErrorLog |
| `services/asr/main.py` | FastAPI `/score` |
| `services/asr/requirements.txt` | Python deps |
| `.cursor/skills/*` | Agent skills for this repo |

## Hard facts internalized

1. Grade **text via ASR**, not audio fingerprint vs Husary.  
2. Tarteel has **no public CAPT API**; they also don’t ship tajweed detection yet.  
3. Phoneme MDD precision is poor for kids → **word-level v1**.  
4. NPL Quran-Lab models cannot power paid features.  
5. Avatar is optional polish; scoring must work first.

## Gaps / next downloads (not in repo yet)

- Full Husary Muallim set → R2  
- Normalized timings JSON for all ayat  
- Next.js app scaffold under `apps/web`  
- Supabase schema SQL  
- Piper praise clips  
