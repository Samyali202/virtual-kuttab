"""
Virtual Kuttab ASR scoring API (Tarteel-style word mistakes only).
POST /score  multipart: audio (wav/mp3), surah, ayah, reference_text
"""
from __future__ import annotations

import io
import os
import subprocess
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
# Browser MediaRecorder → webm/opus; soundfile cannot open those — use ffmpeg.
_FFMPEG_SUFFIXES = {".webm", ".ogg", ".opus", ".mp3", ".m4a", ".mp4", ".aac"}

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


def _ffmpeg_to_wav16k(data: bytes, suffix: str) -> np.ndarray:
    """Decode any ffmpeg-supported container to 16 kHz mono float32."""
    in_path = out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix or ".webm", delete=False) as tin:
            tin.write(data)
            in_path = tin.name
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tout:
            out_path = tout.name
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            in_path,
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "wav",
            out_path,
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr[-800:] if proc.stderr else "ffmpeg failed")
        audio, sr = sf.read(out_path, dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != 16000:
            duration = len(audio) / float(sr)
            target = int(duration * 16000)
            x_old = np.linspace(0, 1, num=len(audio), endpoint=False)
            x_new = np.linspace(0, 1, num=target, endpoint=False)
            audio = np.interp(x_new, x_old, audio).astype(np.float32)
        return audio.astype(np.float32)
    finally:
        for p in (in_path, out_path):
            if p and os.path.exists(p):
                os.unlink(p)


def load_audio_16k_mono(data: bytes, filename: str) -> np.ndarray:
    suffix = (Path(filename).suffix or ".wav").lower()
    # Prefer ffmpeg for browser recordings and compressed formats
    if suffix in _FFMPEG_SUFFIXES:
        return _ffmpeg_to_wav16k(data, suffix)

    bio = io.BytesIO(data)
    try:
        audio, sr = sf.read(bio, dtype="float32")
    except Exception:
        # Last resort: ffmpeg (covers mislabeled / unknown containers)
        return _ffmpeg_to_wav16k(data, suffix if suffix != ".wav" else ".webm")

    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != 16000:
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
    mode: str = Form("beginner"),
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

    return build_error_log(surah, ayah, reference_text, hypothesis, mode=mode)


@app.post("/align-only")
async def align_only(
    surah: int = Form(...),
    ayah: int = Form(...),
    reference_text: str = Form(...),
    hypothesis: str = Form(...),
    mode: str = Form("beginner"),
):
    """Test aligner without ASR (for unit checks)."""
    return build_error_log(surah, ayah, reference_text, hypothesis, mode=mode)
