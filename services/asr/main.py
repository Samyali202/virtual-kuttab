"""
Virtual Kuttab ASR scoring API (Tarteel-style word mistakes only).
POST /score  multipart: audio (wav/mp3), surah, ayah, reference_text
"""
from __future__ import annotations

import io
import os
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from align import build_error_log

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = Path(os.environ.get("ASR_MODEL_DIR", ROOT / "models" / "quran-asr-tiny"))
MODEL_ONNX = MODEL_DIR / "model.int8.onnx"
TOKENS = MODEL_DIR / "tokens.txt"

app = FastAPI(title="Virtual Kuttab ASR", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_recognizer = None


def get_recognizer():
    global _recognizer
    if _recognizer is not None:
        return _recognizer
    if not MODEL_ONNX.exists() or not TOKENS.exists():
        raise RuntimeError(
            f"Model files missing under {MODEL_DIR}. "
            "Need model.int8.onnx and tokens.txt"
        )
    import sherpa_onnx

    _recognizer = sherpa_onnx.OfflineRecognizer.from_zipformer_ctc(
        model=str(MODEL_ONNX),
        tokens=str(TOKENS),
        num_threads=int(os.environ.get("ASR_THREADS", "2")),
    )
    return _recognizer


def load_audio_16k_mono(data: bytes, filename: str) -> np.ndarray:
    # soundfile may not decode mp3; use temp + scipy/ffmpeg fallback later if needed
    bio = io.BytesIO(data)
    try:
        audio, sr = sf.read(bio, dtype="float32")
    except Exception:
        # write temp and retry (wav expected for MVP)
        suffix = Path(filename).suffix or ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            audio, sr = sf.read(tmp_path, dtype="float32")
        finally:
            os.unlink(tmp_path)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != 16000:
        # simple linear resample
        duration = len(audio) / float(sr)
        target = int(duration * 16000)
        x_old = np.linspace(0, 1, num=len(audio), endpoint=False)
        x_new = np.linspace(0, 1, num=target, endpoint=False)
        audio = np.interp(x_new, x_old, audio).astype(np.float32)
    return audio.astype(np.float32)


@app.get("/health")
def health():
    return {
        "ok": True,
        "model_dir": str(MODEL_DIR),
        "model_present": MODEL_ONNX.exists(),
        "mode": "word-level-only",
        "tajweed": False,
    }


@app.post("/score")
async def score(
    audio: UploadFile = File(...),
    surah: int = Form(...),
    ayah: int = Form(...),
    reference_text: str = Form(...),
):
    if not reference_text.strip():
        raise HTTPException(400, "reference_text required")
    raw = await audio.read()
    if not raw:
        raise HTTPException(400, "empty audio")
    try:
        samples = load_audio_16k_mono(raw, audio.filename or "recite.wav")
    except Exception as e:
        raise HTTPException(400, f"audio decode failed: {e}") from e

    try:
        rec = get_recognizer()
    except Exception as e:
        raise HTTPException(503, str(e)) from e

    stream = rec.create_stream()
    stream.accept_waveform(16000, samples)
    rec.decode_stream(stream)
    hypothesis = (stream.result.text or "").strip()

    return build_error_log(surah, ayah, reference_text, hypothesis)


@app.post("/align-only")
async def align_only(
    surah: int = Form(...),
    ayah: int = Form(...),
    reference_text: str = Form(...),
    hypothesis: str = Form(...),
):
    """Test aligner without ASR (for unit checks)."""
    return build_error_log(surah, ayah, reference_text, hypothesis)
