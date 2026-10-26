---
name: vk-asr-scoring
description: >-
  Implement or debug Virtual Kuttab word-level Quran ASR scoring with
  sherpa-onnx and quran-asr-tiny. Use when changing services/asr, ErrorLog
  JSON, Levenshtein aligner, /score API, or false-positive tuning.
---

# VK ASR Scoring

## Location

- `services/asr/main.py` — FastAPI `/health`, `/score`, `/align-only`
- `services/asr/align.py` — normalize + word Levenshtein
- `models/quran-asr-tiny/` — `model.int8.onnx`, `tokens.txt`, `spelling.json`

## Run locally

```powershell
cd D:\ai\Development\Quran\services\asr
python -m pip install -r requirements.txt
$env:ASR_MODEL_DIR = "D:\ai\Development\Quran\models\quran-asr-tiny"
uvicorn main:app --reload --port 8088
```

Test aligner without audio:

```powershell
curl -F surah=1 -F ayah=2 -F "reference_text=الحمد لله رب العالمين" -F "hypothesis=الحمد لله رب" http://127.0.0.1:8088/align-only
```

## Audio contract

- Upload WAV preferred (16 kHz mono float). MP3 may need ffmpeg later.
- ASR output is **undiacritized letters**; aligner strips diacritics from reference by default.

## ErrorLog shape

```json
{
  "surah": 1, "ayah": 2,
  "hypothesis": "...",
  "wer": 0.25,
  "perfect": false,
  "message_ar": "أعد الكلمات المحددة بهدوء",
  "errors": [{"type":"deletion","ref_index":3,"ref_token":"العالمين"}],
  "words": [{"ref_index":0,"ref_token":"الحمد","status":"ok"}]
}
```

## Precision rules

- Child/default mode: prefer silence over false flags  
- Target: false positives on correct clips &lt; 5% before shipping  
- Never add tajweed fields to ErrorLog in v1  

## Reference OSS

- `vendor/hifz-tester` — word-level UX patterns  
- `vendor/tilawa` — tracking ideas (watch licenses)  
- Hugging Face `Abdou/quran-asr-tiny` README in model folder
