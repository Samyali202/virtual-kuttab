# Virtual Kuttab — Deep Research Technical Architecture Report
*Generated: 2026-10-26 | Sources: 18+ | Confidence: High (ASR benchmarks) / Medium (child-speech gap)*
*Research LLM: Claude Opus 4.8 (thinking-high)*

---

## اختيار نموذج البحث (Meta)

| Criterion | Selection |
|---|---|
| Task type | Multi-source deep research + systems architecture |
| Selected LLM | **Claude Opus 4.8 thinking-high** (`claude-opus-4-8-thinking-high`) |
| Why | Highest reasoning depth for cross-benchmark synthesis, license-risk analysis, and production blueprint fidelity |

---

## الملخص التنفيذي

أفضل عائلة مفتوحة المصدر لتقييم التلاوة القرآنية عام 2026 هي **Zipformer2-CTC Phoneme** (سلسلة Quran-Lab / Muno459)، لأنها تُخرج فونيمات بلا Language Model فلا تُصحّح خطأ الطفل تلقائياً، وتدعم البث المباشر عبر `sherpa-onnx` بحجم ~73 MB INT8. أفضل دقة نصية offline هي **FastConformer-Quran** (WER 5.41%). لكن أوزان Quran-Lab/Muno459 مرخّصة **NPL-1.1/1.2 (غير ربحية)** فغير صالحة لمنتج مدفوع. لمشروع startup تجاري: MVP على **`Abdou/quran-asr-tiny` (MIT)** ثم تدريب Zipformer2-CTC خاص من بيانات EveryAyah/tlog على قاعدة NVIDIA CC-BY.

---

## 1. تقييم Quranic ASR — State of the Art (2026)

### 1.1 مصدر الحقيقة التجريبي

المعيار التسريب-الحر الموحّد:

- Dataset: `Quran-Lab/quranic-asr-benchmark` (600 clips: EveryAyah unseen / QUL Al-Nufais / tlog phone)
- Leaderboard: `Quran-Lab/quranic-asr-leaderboard`
- CAPT phoneme shared task: **Iqra'Eval 2025** (ArabicNLP) — QuranMB mispronunciation detection

### 1.2 مقارنة الثلاثة الأوائل (منهجيات)

| Rank | Methodology / Model | Mode | Overall WER | Phone WER | Params / Size | Latency profile | Mistake fidelity | License |
|---|---|---|---|---|---|---|---|---|
| A | **Zipformer2 Phoneme-CTC** — `Quran-Lab/zipformer_p-arabic-v3` / `Muno459/zipformer_p-quran` | Streaming | **3.46–5.83** (retrieval) | 7.56–13.5 PER | 65.5M · **73 MB INT8** | 320–1000 ms lookahead; RTF ≪ 1 on CPU | **Excellent** — no LM, phonemes | **NPL-1.1/1.2** |
| B | **FastConformer-Quran CTC** — `Muno459/fastconformer-quran` | Offline (streaming sibling: 10.53 WER) | **5.41** | 8.88 | 115M · 219 MB fp16 ONNX | Offline full-utt; RTF ~0.001 GPU | **Strong** — CTC + GOP/head (~80% TPR @ 9% FPR) | **NPL-1.1** |
| C | **Tiny Conformer-CTC** — `Abdou/quran-asr-tiny` | Offline (sherpa-onnx) | **6.94** (int8 7.08) | 17.95 | **16M · 19 MB INT8** | Whole-bench 2.1h in 31s / 4 CPU threads | **Good for letters**, **no harakat/tajweed** | **MIT** |

مراجع المقارنة الخارجية على نفس الـ benchmark:

| Model | Overall WER | Notes |
|---|---|---|
| NVIDIA `stt_ar_fastconformer_hybrid` | 7.44 | Previous public #1; CC-BY-4.0 base |
| Tarteel production realtime | 9.56 | Streaming FastConformer (closed) |
| Whisper-large-v3 | 10.10 | Phone collapse 26.23 |
| Tarteel `whisper-base-ar-quran` (chunked) | 7.97 | Old open Whisper fine-tune |

#### تحليل العمود الأهم لمنصة تعليمية

1. **WER على هاتف/ضجيج:** Zipformer-v3 phone PER 3.65%؛ FastConformer-Quran phone WER 8.88%؛ Tiny phone WER 17.95% — Tiny يضعف على الميكروفون الحقيقي.
2. **Latency Streaming vs Batch:** Zipformer فقط مصمّم للبث cache-aware؛ FastConformer-Quran offline يتفوق دقةً؛ نسخته streaming تهبط إلى ~10.53 WER.
3. **استهلاك الموارد:** Tiny (19 MB) أرخص؛ Zipformer INT8 (73 MB) أفضل توازن؛ FastConformer fp16 (219 MB) يحتاج عقدة أقوى أو GPU.
4. **عدم التصحيح التلقائي:** Zipformer و Tiny بلا LM؛ نماذج Whisper/RNNT+LM تميل لإخفاء الحذف/الاستبدال — مرفوضة بيداغوجياً.

#### تحذيرات حرجة للأطفال (من بطاقة v3)

- تحت 12 سنة: أداء أسوأ ×2–×3 على `qdat_bench`.
- النموذج مدرّب غالباً على تلاوة صحيحة → قد يكتب القاعدة لا الانحراف (مثال: ikhfaa وهمي في 81/94 عينة).
- أطوال المد الحرّة: قِسْها بـ forced-alignment timing لا بعدّ الرموز.

### 1.3 Winner Model (إعلان صريح)

```
WINNER (Pedagogy + Streaming Architecture):
  Family:  Zipformer2-CTC Phoneme (Quran-Lab line)
  Spec:    Quran-Lab/zipformer_p-arabic-v3.1  OR  Muno459/zipformer_p-quran
  Runtime: sherpa-onnx OnlineRecognizer · INT8 ONNX · 16 kHz · 80-dim Kaldi fbank (povey)

WINNER (Commercial Startup MVP — cost-effective & licensable):
  Model:   Abdou/quran-asr-tiny (MIT)
  Path:    letter-level MVP → self-train Zipformer2-CTC (own weights) on
           EveryAyah + curated child/tlog data using icefall export → sherpa-onnx
```

**لماذا يناسب startup مقيّد الميزانية؟**

- INT8 Zipformer/Tiny يعمل على CPU-only (4–8 threads) بدون GPU.
- لا حاجة لـ vLLM/TensorRT لنواة ASR (هذه لـ LLM الشيخ فقط).
- نفس واجهة `sherpa-onnx` للموبايل (Android/iOS) والسيرفر → كود واحد.
- مسار الترخيص: لا تُدمج أوزان NPL في منتج مدفوع؛ استخدم MIT Tiny أو أوزانك الخاصة.

---

## 2. Real-Time Audio & Streaming Pipeline (< 1.5 s E2E)

### 2.1 ميزانية الكمون (Latency Budget)

| Stage | Budget | Mechanism |
|---|---|---|
| Mic capture + Opus encode | 20–40 ms | WebRTC or MediaRecorder PCM |
| Network uplink (chunk) | 50–150 ms | 320–480 ms audio frames |
| VAD / denoise (optional) | 20–40 ms | Silero VAD ONNX / GTCRN |
| ASR lookahead + decode | **320–640 ms** | Zipformer chunk 8–16 |
| Alignment + JSON errors | 5–20 ms | Python Levenshtein / rapidfuzz |
| Sheikh LLM (cached templates first) | 50–300 ms | Rule templates → small LLM fallback |
| TTS / avatar cue | 100–250 ms | Piper / pre-baked clips |
| **Total target** | **≤ 1500 ms** | Prefer template path for common errors |

### 2.2 البروتوكول المختار

| Layer | Choice | Rationale |
|---|---|---|
| Browser → Edge | **WebRTC** (audio track) *or* **WebSocket binary PCM** | WebRTC أفضل لـ NAT/jitter؛ WebSocket أبسط للنشر |
| Signaling | FastAPI + `aiortc` (WebRTC) أو raw WS | Python-native |
| Chunk format | `int16` LE mono **16 kHz**, frames **320–480 ms** | Matches Zipformer training |
| Features | Kaldi fbank 80-bin, 25 ms / 10 ms, **povey** window | Slaney-mel يضاعف تقريباً معدل الخطأ |
| Inference runtime | **`sherpa-onnx` + ONNX Runtime** | Not TensorRT/vLLM for ASR |
| Concurrency | C++ `sherpa-onnx-online-websocket-server` *or* Python pool of `OnlineRecognizer` | Batch max 4–8 streams/CPU node |

**لا تستخدم vLLM لنواة ASR.** vLLM للـ LLM الخفيف فقط (الشيخ).

### 2.3 مخطط التدفق (ASCII)

```
Child Mic
   │  WebRTC / WS binary PCM@16kHz
   ▼
┌──────────────────────┐
│  gateway (FastAPI)   │  session auth, rate-limit, child_id
│  + Silero VAD        │
└──────────┬───────────┘
           │ Redis Streams / direct call
           ▼
┌──────────────────────┐
│  asr-worker          │  sherpa-onnx OnlineRecognizer
│  Zipformer INT8 CTC  │  cache-aware state per session
└──────────┬───────────┘
           │ phoneme / letter hypothesis + confidence
           ▼
┌──────────────────────┐
│  aligner service     │  vs Uthmani reference ayah
│  → ErrorLog JSON     │
└──────────┬───────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
 template FB   LLM Sheikh (llama.cpp / vLLM AWQ)
     │            │
     └─────┬──────┘
           ▼
   Avatar / TTS / WebSocket events
           ▼
   Postgres (hifz metrics) + Redis cache
```

### 2.4 Backend code skeleton (Python)

```python
# services/asr_gateway/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import numpy as np
import sherpa_onnx

app = FastAPI()

def build_recognizer() -> sherpa_onnx.OnlineRecognizer:
    return sherpa_onnx.OnlineRecognizer.from_zipformer2_ctc(
        tokens="models/tokens.txt",
        model="models/zipformer_p_arabic_v3.1.int8.onnx",
        num_threads=2,
        sample_rate=16000,
        feature_dim=80,
        # decoding_method greedy_search — NO LM rescoring
    )

RECOGNIZER = build_recognizer()

@app.websocket("/ws/recite/{session_id}")
async def recite(ws: WebSocket, session_id: str):
    await ws.accept()
    stream = RECOGNIZER.create_stream()
    try:
        while True:
            msg = await ws.receive_bytes()  # int16 LE PCM chunk
            samples = np.frombuffer(msg, dtype=np.int16).astype(np.float32) / 32768.0
            stream.accept_waveform(16000, samples)
            while RECOGNIZER.is_ready(stream):
                RECOGNIZER.decode_stream(stream)
            result = RECOGNIZER.get_result(stream)
            await ws.send_json({
                "type": "partial",
                "text": result.text,          # phonemes or letters
                "is_endpoint": RECOGNIZER.is_endpoint(stream),
            })
            if RECOGNIZER.is_endpoint(stream):
                RECOGNIZER.reset(stream)
    except WebSocketDisconnect:
        pass
```

### 2.5 أطر العمل الدقيقة للنشر

| Component | Exact stack |
|---|---|
| API | FastAPI + Uvicorn (`uvloop`, `httptools`) |
| Streaming ASR | `sherpa-onnx` OnlineRecognizer / C++ websocket server |
| Optional WebRTC | `aiortc` + Coturn |
| Feature extract | Built into sherpa-onnx (Kaldi fbank) |
| Queue | Redis Streams (`XADD` audio meta / jobs) |
| Worker pool | ProcessPool / separate containers per N sessions |
| LLM Sheikh | `llama.cpp` server **or** vLLM with AWQ 0.5–3B |
| TTS | Piper ONNX / pre-recorded encouragement clips |
| Observability | Prometheus + OpenTelemetry |

---

## 3. Text Alignment & Pedagogical Feedback

### 3.1 مبدأ المقارنة

- المرجع: نص عثماني مشكول للآية المستهدفة (Hafs) + جدول فونيمات حتمي إن استخدمت Zipformer.
- فرضية الطفل: مخرجات ASR **كما نُطقت** (بدون تصحيح LM).
- المحاذاة: Word-level (ثم phoneme-level) Levenshtein / Needleman–Wunsch.
- أنواع الخطأ: `deletion` | `substitution` | `insertion` (+ اختياري `tajweed`).

### 3.2 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "RecitationErrorLog",
  "type": "object",
  "required": ["session_id", "child_id", "surah", "ayah", "reference_uthmani", "hypothesis", "errors", "metrics"],
  "properties": {
    "session_id": { "type": "string", "format": "uuid" },
    "child_id": { "type": "string" },
    "surah": { "type": "integer", "minimum": 1, "maximum": 114 },
    "ayah": { "type": "integer", "minimum": 1 },
    "riwayah": { "type": "string", "const": "hafs" },
    "reference_uthmani": { "type": "string" },
    "hypothesis": { "type": "string" },
    "unit": { "type": "string", "enum": ["word", "phoneme", "letter"] },
    "errors": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "ref_index", "hyp_index", "ref_token", "hyp_token"],
        "properties": {
          "type": { "type": "string", "enum": ["deletion", "substitution", "insertion"] },
          "ref_index": { "type": ["integer", "null"] },
          "hyp_index": { "type": ["integer", "null"] },
          "ref_token": { "type": ["string", "null"] },
          "hyp_token": { "type": ["string", "null"] },
          "severity": { "type": "number", "minimum": 0, "maximum": 1 },
          "severityweed_rule": { "type": ["string", "null"] },
          "severity_ar": { "type": "string" }
        }
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "wer": { "type": "number" },
        "cer": { "type": "number" },
        "per": { "type": ["number", "null"] },
        "words_correct": { "type": "integer" },
        "words_total": { "type": "integer" }
      }
    },
    "latency_ms": { "type": "integer" }
  }
}
```

### 3.3 Production alignment algorithm

```python
# services/aligner/recitation_align.py
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
import unicodedata
import re

class ErrorType(str, Enum):
    DELETION = "deletion"
    SUBSTITUTION = "substitution"
    INSERTION = "insertion"

# Arabic diacritics / tatweel for optional strip modes
_DIAC = re.compile(r"[\u064B-\u065F\u0670\u0640]")

def normalize_uthmani(text: str, strip_diacritics: bool = False) -> str:
    text = unicodedata.normalize("NFC", text.strip())
    text = text.replace("\u06d6", "").replace("\u06d7", "")  # waqf marks optional
    if strip_diacritics:
        text = _DIAC.sub("", text)
    return re.sub(r"\s+", " ", text)


def tokenize_words(text: str) -> List[str]:
    return [t for t in normalize_uthmani(text).split(" ") if t]


@dataclass
class AlignmentError:
    type: ErrorType
    ref_index: Optional[int]
    hyp_index: Optional[int]
    ref_token: Optional[str]
    hyp_token: Optional[str]
    severity: str = "word"


def align_words(reference: str, hypothesis: str) -> tuple[list[AlignmentError], float]:
    """Classic Wagner-Fischer; operations map 1:1 to pedagogical error types."""
    ref = tokenize_words(reference)
    hyp = tokenize_words(hypothesis)
    n, m = len(ref), len(hyp)

    # dp[i][j] = edit distance; backpointer matrix
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    bp = [[None] * (m + 1) for _ in range(n + 1)]  # 'D','I','S','M'

    for i in range(1, n + 1):
        dp[i][0] = i
        bp[i][0] = "D"
    for j in range(1, m + 1):
        dp[0][j] = j
        bp[0][j] = "I"

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref[i - 1] == hyp[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
                bp[i][j] = "M"
            else:
                costs = (
                    (dp[i - 1][j] + 1, "D"),
                    (dp[i][j - 1] + 1, "I"),
                    (dp[i - 1][j - 1] + 1, "S"),
                )
                dp[i][j], bp[i][j] = min(costs, key=lambda x: x[0])

    errors: list[AlignmentError] = []
    i, j = n, m
    while i > 0 or j > 0:
        op = bp[i][j]
        if op == "M":
            i, j = i - 1, j - 1
        elif op == "S":
            errors.append(AlignmentError(
                ErrorType.SUBSTITUTION, i - 1, j - 1, ref[i - 1], hyp[j - 1]
            ))
            i, j = i - 1, j - 1
        elif op == "D":
            errors.append(AlignmentError(
                ErrorType.DELETION, i - 1, None, ref[i - 1], None
            ))
            i -= 1
        elif op == "I":
            errors.append(AlignmentError(
                ErrorType.INSERTION, None, j - 1, None, hyp[j - 1]
            ))
            j -= 1
        else:
            break

    errors.reverse()
    wer = (dp[n][m] / max(n, 1)) if n else (0.0 if m == 0 else 1.0)
    return errors, wer


def build_error_log(
    session_id: str,
    child_id: str,
    surah: int,
    ayah: int,
    reference_uthmani: str,
    hypothesis: str,
    unit: str = "word",
) -> dict:
    errs, wer = align_words(reference_uthmani, hypothesis)
    payload_errors = []
    for e in errs:
        severity_ar = {
            ErrorType.DELETION: "حذفتَ كلمةً",
            ErrorType.SUBSTITUTION: "بدّلتَ كلمةً",
            ErrorType.INSERTION: "زدتَ كلمةً",
        }[e.type]
        payload_errors.append({
            "type": e.type.value,
            "ref_index": e.ref_index,
            "hyp_index": e.hyp_index,
            "ref_token": e.ref_token,
            "hyp_token": e.hyp_token,
            "confidence": 0.85,
            "tajweed_rule": None,
            "severity_ar": f"{severity_ar}: المتوقع «{e.ref_token}» / المسموع «{e.hyp_token}»",
        })
    ref_tokens = tokenize_words(reference_uthmani)
    return {
        "session_id": session_id,
        "child_id": child_id,
        "surah": surah,
        "ayah": ayah,
        "riwayah": "hafs",
        "reference_uthmani": reference_uthmani,
        "hypothesis": hypothesis,
        "unit": unit,
        "errors": payload_errors,
        "metrics": {
            "wer": round(wer, 4),
            "cer": None,
            "per": None,
            "words_correct": max(len(ref_tokens) - len(errs), 0),
            "words_total": len(ref_tokens),
        },
    }
```

**ملاحظة إنتاج:** لفونيمات Zipformer استخدم نفس الخوارزمية على قوائم الفونيمات من `quran_text2phoneme.json` / `ordered_quran_phonemes.json`، واحسب PER بدل WER.

### 3.4 Hardened System Prompt — Virtual Sheikh (lightweight LLM)

```text
SYSTEM PROMPT — Virtual Sheikh (Virtual Kuttab)
==============================================
You are "الشيخ الافتراضي", a warm, patient Quran teacher for children aged 5–12.
Language: Arabic (simple Fus'ha / child-friendly). Never use English unless the child wrote English.

INPUT
You receive ONE JSON object of type RecitationErrorLog. Trust only that JSON.
Do NOT invent ayah text. Do NOT claim religious rulings (fatwa). Do NOT shame.

HARD RULES
1. If errors[] is empty: praise briefly (1–2 sentences), invite the next ayah.
2. If errors exist: address AT MOST the first 2 errors. Ignore the rest this turn.
3. Never say the child is "wrong" in a harsh way. Prefer: "خلّينا نعيد هذه الكلمة بهدوء".
4. Quote the expected word (ref_token) clearly; if hyp_token exists, gently contrast.
5. One concrete tip only (e.g., slow down, open the mouth for madd, listen then repeat).
6. Max 3 short sentences + optional one emoji-free encouragement phrase.
7. If confidence on an error is < 0.6 OR metrics.wer > 0.6: ask to repeat the whole ayah; do not over-correct.
8. Refuse politics, adult topics, or non-Quran chat. Redirect kindly to the lesson.
9. Always remind: "هذا مساعد تقني ولا يغني عن معلّم مؤهّل" once per session only (flag in JSON if already said).
10. Output MUST be valid JSON:
{
  "spoken_ar": "...",
  "highlight_ref_indices": [int],
  "action": "praise" | "retry_word" | "retry_ayah" | "next_ayah",
  "avatar_clip_id": "encourage_01" | "retry_word_01" | "mashaallah_01"
}

FEW-SHOT STYLE
User JSON: substitution مالك→ملك
Assistant:
{
  "spoken_ar": "أحسنتَ على المحاولة! كلمة «مَالِكِ» فيها مدّ صغير. اسمعها ثم أعدها بهدوء: مَا لِكِ.",
  "highlight_ref_indices": [0],
  "action": "retry_word",
  "avatar_clip_id": "retry_word_01"
}
```

موصى به للاستدلال السريع: **Qwen2.5-0.5B/1.5B-Instruct AWQ** أو **Phi-3.5-mini** عبر `llama.cpp` (CPU) أو vLLM (GPU صغير) — ليس نموذجاً عملاقاً.

---

## 4. SysAdmin Production Deployment Blueprint

### 4.1 `docker-compose.yml`

```yaml
# docker-compose.yml — Virtual Kuttab production stack (CPU-first)
version: "3.9"

x-logging: &default-logging
  driver: json-file
  options:
    max-size: "20m"
    max-file: "5"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: virtual_kuttab
      POSTGRES_USER: kuttab
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kuttab -d virtual_kuttab"]
      interval: 10s
      timeout: 5s
      retries: 10
    logging: *default-logging

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--save", "60", "1000", "--appendonly", "yes"]
    volumes:
      - redisdata:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 10
    logging: *default-logging

  asr-engine:
    build:
      context: ./services/asr_engine
      dockerfile: Dockerfile  # ubuntu + sherpa-onnx + model volume
    environment:
      MODEL_PATH: /models/zipformer.int8.onnx
      TOKENS_PATH: /models/tokens.txt
      NUM_THREADS: "4"
      MAX_SESSIONS: "32"
      PORT: "6006"
    volumes:
      - ./models:/models:ro
    ports:
      - "6006:6006"
    deploy:
      resources:
        limits:
          cpus: "4.0"
          memory: 4G
    restart: unless-stopped
    logging: *default-logging

  api:
    build:
      context: ./services/api
      dockerfile: Dockerfile  # FastAPI gateway + aligner
    environment:
      DATABASE_URL: postgresql+asyncpg://kuttab:${POSTGRES_PASSWORD}@postgres:5432/virtual_kuttab
      REDIS_URL: redis://redis:6379/0
      ASR_WS_URL: ws://asr-engine:6006
      LLM_URL: http://sheikh-llm:8080/v1/chat/completions
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      asr-engine:
        condition: service_started
      sheikh-llm:
        condition: service_started
    restart: unless-stopped
    logging: *default-logging

  sheikh-llm:
    image: ghcr.io/ggerganov/llama.cpp:server
    command:
      - "-m"
      - "/models/qwen2.5-1.5b-instruct-q4_k_m.gguf"
      - "--host"
      - "0.0.0.0"
      - "--port"
      - "8080"
      - "-c"
      - "2048"
      - "-t"
      - "4"
      - "--parallel"
      - "2"
    volumes:
      - ./models/llm:/models:ro
    ports:
      - "8080:8080"
    deploy:
      resources:
        limits:
          cpus: "4.0"
          memory: 3G
    restart: unless-stopped
    logging: *default-logging

  worker:
    build:
      context: ./services/worker
      dockerfile: Dockerfile  # Celery/RQ: metrics aggregation, clip prefetch
    environment:
      DATABASE_URL: postgresql+asyncpg://kuttab:${POSTGRES_PASSWORD}@postgres:5432/virtual_kuttab
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
    logging: *default-logging

  coturn:
    image: coturn/coturn:4.6
    network_mode: host
    volumes:
      - ./ops/turnserver.conf:/etc/coturn/turnserver.conf:ro
    profiles: ["webrtc"]
    logging: *default-logging

volumes:
  pgdata:
  redisdata:
```

### 4.2 مخطط قاعدة بيانات الحفظ اليومي (excerpt)

```sql
-- db/init.sql
CREATE TABLE children (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  birth_year INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE hifz_sessions (
  id UUID PRIMARY KEY,
  child_id UUID REFERENCES children(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  device_class TEXT  -- phone|tablet|desktop
);

CREATE TABLE ayah_attempts (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES hifz_sessions(id),
  child_id UUID REFERENCES children(id),
  surah INT NOT NULL,
  ayah INT NOT NULL,
  wer REAL,
  cer REAL,
  per REAL,
  error_json JSONB NOT NULL,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attempts_child_day
  ON ayah_attempts (child_id, ((created_at AT TIME ZONE 'UTC')::date));

CREATE MATERIALIZED VIEW daily_hifz_metrics AS
SELECT
  child_id,
  (created_at AT TIME ZONE 'UTC')::date AS day,
  COUNT(*) AS attempts,
  AVG(wer) AS avg_wer,
  SUM(CASE WHEN wer = 0 THEN 1 ELSE 0 END) AS perfect_ayahs,
  COUNT(DISTINCT (surah, ayah)) AS unique_ayat
FROM ayah_attempts
GROUP BY 1, 2;
```

### 4.3 استراتيجيات SysAdmin للمضيف المقيّد الموارد

| Strategy | Concrete action |
|---|---|
| Quantization | ASR INT8 ONNX; LLM GGUF Q4_K_M |
| Threading | `NUM_THREADS=2–4` per ASR process; pin with `taskset`; avoid oversubscribe |
| Caching | Redis: reference ayah phonemes, template feedback by error signature hash |
| Session affinity | Sticky WS to one asr-engine replica (cache state is local) |
| Template-first UX | 80% feedback بدون LLM → يخفض CPU ويضمن <1.5s |
| Audio codec | Prefer PCM16 short chunks; Opus only if bandwidth constrained (decode cost) |
| Horizontal scale | Replicate `asr-engine` behind HAProxy sticky sessions |
| Avoid | Full Whisper-large, GPU TensorRT unless traffic يبرر التكلفة |
| Child fine-tune | اجمع بيانات أطفال (بموافقة ولي الأمر) وأعد تدريب Zipformer CTC — يعالج فجوة تحت-12 |
| License gate | CI check يمنع سحب أوزان NPL إلى `prod` إن كان المنتج مدفوعاً |
| ONNX Runtime pin | استخدم ORT ≤ 1.26 لرسوم Zipformer معينة (1.27 قد يُخرج blanks) |

### 4.4 تقدير سعة عقدة واحدة (إرشادي)

| Node | Workload |
|---|---|
| 8 vCPU / 16 GB RAM (CPU-only) | ~20–40 concurrent streaming ASR sessions (INT8 Zipformer) + 1× 1.5B Q4 LLM |
| Budget GPU (T4 16 GB) | نفس ASR على CPU + LLM أسرع، أو دفعات محاذاة أكبر |

---

## Key Takeaways

1. **أفضل دقة تعليمية Streaming:** Zipformer2 Phoneme-CTC (Quran-Lab line) — بلا LM، يلتقط الحذف/الاستبدال.
2. **أفضل دقة Offline نصية:** FastConformer-Quran 5.41% WER + رأس نطق متعدد الإشارات.
3. **أفضل خيار startup مرخّص ورخيص:** `Abdou/quran-asr-tiny` (MIT) كـ MVP، ثم أوزان Zipformer مدرّبة داخلياً.
4. **المسار التشغيلي:** WebSocket/WebRTC → sherpa-onnx → aligner JSON → template/LLM Sheikh → Postgres metrics.
5. **الكمون:** chunk 320–480 ms + lookahead ≤640 ms + قوالب تغذية راجعة يبقي E2E تحت 1.5 ثانية.
6. **مخاطر:** رخصة NPL تمنع الربح؛ أداء الأطفال أضعف؛ لا تعتمد على النموذج وحده لحكم التجويد الدقيق.

---

## Sources

1. [Muno459/fastconformer-quran](https://huggingface.co/Muno459/fastconformer-quran) — Offline SOTA 5.41% WER + pronunciation head
2. [Muno459/zipformer_p-quran](https://huggingface.co/Muno459/zipformer_p-quran) — Best streaming phoneme model on board (~5.83 WER)
3. [Quran-Lab/zipformer_p-arabic-v3](https://huggingface.co/Quran-Lab/zipformer_p-arabic-v3) — v3/v3.1 streaming CTC, child & tajweed limitations
4. [Abdou/quran-asr-tiny](https://huggingface.co/Abdou/quran-asr-tiny) — MIT 16M mobile model, 6.94% WER
5. [Quran-Lab/quranic-asr-benchmark](https://huggingface.co/datasets/Quran-Lab/quranic-asr-benchmark) — Leakage-free 600-clip eval
6. [Quran-Lab/quranic-asr-leaderboard](https://huggingface.co/spaces/Quran-Lab/quranic-asr-leaderboard) — Live comparisons
7. [Iqra'Eval 2025](https://aclanthology.org/2025.arabicnlp-sharedtasks.61.pdf) — Phoneme MDD shared task
8. [Unified Arabic Pronunciation Benchmark](https://arxiv.org/html/2506.07722) — QuranMB framework
9. [Hafs2Vec](https://aclanthology.org/2025.arabicnlp-sharedtasks.62.pdf) — wav2vec2-xls-r MDD F1 46.5%
10. [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) — Production ONNX streaming ASR
11. [sherpa-onnx online WebSocket docs](https://k2-fsa.github.io/sherpa/onnx/websocket/online-websocket.html)
12. [NVIDIA NeMo cache-aware streaming](https://github.com/NVIDIA-NeMo/NeMo/blob/main/tutorials/asr/Online_ASR_Microphone_Demo_Cache_Aware_Streaming.ipynb)
13. [Arabic FastConformer streaming sherpa export](https://huggingface.co/dev-ahmedhany/stt_ar_fastconformer_hybrid_large_streaming_pcd_v1.1-sherpa)
14. [NPL-1.1 LICENSE](https://huggingface.co/Muno459/fastconformer-quran/blob/main/LICENSE) — No-profit constraint
15. [Tidzo/darten-zipformer-quran](https://huggingface.co/Tidzo/darten-zipformer-quran) — ORT 1.27 blank-output caveat
16. [yazinsai/tilawa](https://github.com/yazinsai/tilawa) — License-split reference stack

## Methodology

Searched 8+ web queries covering Quranic ASR leaderboards, Iqra'Eval CAPT, sherpa-onnx streaming, NeMo WebRTC, and commercial licenses. Deep-read Hugging Face model cards for FastConformer-Quran, zipformer_p-quran, zipformer_p-arabic-v3, and quran-asr-tiny, plus Iqra'Eval papers.

Sub-questions: (1) SOTA Quranic ASR, (2) streaming latency stack, (3) alignment/feedback, (4) deployable docker/sysadmin under cost constraints.
