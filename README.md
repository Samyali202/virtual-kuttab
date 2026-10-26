# Virtual Kuttab

Tarteel-style Quran **Hifz** platform: listen to **Husary Muallim only** → repeat → recite → **word-level** feedback (no tajweed; no other qaris).

## Quick start

### 1. ASR scoring API

```powershell
cd D:\ai\Development\Quran\services\asr
python -m pip install -r requirements.txt
$env:ASR_MODEL_DIR = "D:\ai\Development\Quran\models\quran-asr-tiny"
uvicorn main:app --reload --port 8088
```

Health: http://127.0.0.1:8088/health

### 2. Content already on disk

- `content/audio/husary_sample/` — Al-Fatihah Husary MP3s  
- `content/timings/husary/` — timing text files  
- `content/tanzil/` — Quran JSON seed  
- `models/quran-asr-tiny/` — MIT ASR model  

### 3. Reference OSS

See `vendor/` (hifz-tester, tilawa, quran-align, mahfuz, …).

## Product docs

| File | Purpose |
|---|---|
| `docs/PRODUCT-DECISION-TARTEEL-STYLE-HIFZ.md` | **Locked product decisions** |
| `docs/BULLETPROOF-ARCHITECTURE-VERDICT.md` | Expert validation |
| `docs/learned/INVENTORY.md` | What was downloaded & studied |

## Cursor skills (project)

| Skill | When |
|---|---|
| `virtual-kuttab` | Any feature in this product |
| `vk-asr-scoring` | ASR / aligner / `/score` |
| `vk-content-audio` | Text, Husary, timings, R2 |
| `vk-listen-recite-ui` | Next.js Listen/Recite UI |

## Stack (v1)

Next.js · FastAPI + sherpa-onnx + quran-asr-tiny · Supabase · Cloudflare R2 · Husary human audio · word Levenshtein feedback · optional static/Rive avatar later
