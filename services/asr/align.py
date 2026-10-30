"""Word-level Levenshtein aligner for Tarteel-style (non-tajweed) grading."""
from __future__ import annotations

import json
import os
import re
import unicodedata
from dataclasses import dataclass
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

# Arabic diacritics + tatweel + Quran marks that survive "letter" compares
_DIAC = re.compile(
    r"[\u064B-\u065F\u0670\u0640\u06D6-\u06ED\u08F0-\u08FF]"
)

class ErrorType(str, Enum):
    DELETION = "deletion"
    SUBSTITUTION = "substitution"
    INSERTION = "insertion"
    MATCH = "match"


@dataclass(frozen=True)
class Sensitivity:
    """How forgiving word matching is (still word-level — not tajweed)."""

    key: str
    soft_cer: float
    max_edits: int
    min_len: int
    allow_alef_flex: bool
    label_ar: str


# child = lenient · beginner = medium · professional = exact after spelling/normalize
SENSITIVITY_PROFILES: dict[str, Sensitivity] = {
    "child": Sensitivity(
        key="child",
        soft_cer=0.34,
        max_edits=2,
        min_len=3,
        allow_alef_flex=True,
        label_ar="طفل",
    ),
    "beginner": Sensitivity(
        key="beginner",
        soft_cer=0.18,
        max_edits=1,
        min_len=4,
        allow_alef_flex=True,
        label_ar="مبتدئ",
    ),
    "professional": Sensitivity(
        key="professional",
        soft_cer=0.0,
        max_edits=0,
        min_len=99,
        allow_alef_flex=False,
        label_ar="محترف",
    ),
}

DEFAULT_MODE = "beginner"


def resolve_mode(mode: Optional[str]) -> Sensitivity:
    key = (mode or DEFAULT_MODE).strip().lower()
    aliases = {
        "kid": "child",
        "kids": "child",
        "طفل": "child",
        "adult_beginner": "beginner",
        "adult-beginner": "beginner",
        "مبتدئ": "beginner",
        "pro": "professional",
        "adult_professional": "professional",
        "محترف": "professional",
    }
    key = aliases.get(key, key)
    return SENSITIVITY_PROFILES.get(key, SENSITIVITY_PROFILES[DEFAULT_MODE])


@dataclass
class WordVerdict:
    type: ErrorType
    ref_index: Optional[int]
    hyp_index: Optional[int]
    ref_token: Optional[str]
    hyp_token: Optional[str]


@lru_cache(maxsize=1)
def _spelling_table() -> dict[str, str]:
    """Uthmani rasm → standard spelling (quran-asr-tiny spelling.json)."""
    env = os.environ.get("ASR_SPELLING_JSON")
    candidates = []
    if env:
        candidates.append(Path(env))
    here = Path(__file__).resolve()
    candidates.extend(
        [
            here.parents[2] / "models" / "quran-asr-tiny" / "spelling.json",
            Path("/opt/vk-asr/models/quran-asr-tiny/spelling.json"),
            here.parent / "spelling.json",
        ]
    )
    for p in candidates:
        if p.is_file():
            with p.open(encoding="utf-8") as f:
                raw = json.load(f)
            return {str(k): str(v) for k, v in raw.items()}
    return {}


def normalize_arabic(text: str, strip_diacritics: bool = True) -> str:
    text = unicodedata.normalize("NFC", (text or "").strip())
    text = (
        text.replace("\ufeff", "")
        .replace("\u200f", "")
        .replace("\u200e", "")
        .replace("\u200c", "")
        .replace("\u200d", "")
    )
    if strip_diacritics:
        text = _DIAC.sub("", text)
    # Alif wasla / dagger alef leftovers → plain alif
    text = text.replace("ٱ", "ا").replace("ٰ", "ا")
    # Common letter folds for robust matching (ASR + mushaf variants)
    text = (
        text.replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
        .replace("ٱ", "ا")
        .replace("ى", "ي")
        .replace("ة", "ه")
        .replace("ؤ", "و")
        .replace("ئ", "ي")
        .replace("ء", "")
    )
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str, strip_diacritics: bool = True) -> List[str]:
    n = normalize_arabic(text, strip_diacritics=strip_diacritics)
    return [t for t in n.split(" ") if t]


def apply_spelling(tokens: List[str]) -> List[str]:
    """Rewrite Uthmani ASR tokens into standard spelling when known."""
    table = _spelling_table()
    if not table:
        return tokens
    out: list[str] = []
    for t in tokens:
        mapped = table.get(t, t)
        # spelling may expand one token into multiple (يايها → يا ايها)
        parts = mapped.split()
        out.extend(parts if parts else [t])
    return out


def _lev_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            ins, delete, sub = cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (ca != cb)
            cur.append(min(ins, delete, sub))
        prev = cur
    return prev[-1]


def _strip_alef(tok: str) -> str:
    return tok.replace("ا", "") or tok


def tokens_match(ref: str, hyp: str, sens: Sensitivity) -> bool:
    """Match after normalize + spelling.json, with mode-based soft letter rules."""
    if ref == hyp:
        return True
    n = max(len(ref), len(hyp), 1)
    dist = _lev_distance(ref, hyp)
    if (
        sens.max_edits > 0
        and sens.soft_cer > 0
        and n >= sens.min_len
        and dist <= sens.max_edits
        and dist / n <= sens.soft_cer
        and abs(len(ref) - len(hyp)) <= sens.max_edits
    ):
        return True
    # Child/beginner: missing elongated alef only (ASR rasm noise)
    if sens.allow_alef_flex and n >= 4 and _strip_alef(ref) == _strip_alef(hyp):
        return True
    return False


def align_words(
    reference: str,
    hypothesis: str,
    mode: Optional[str] = None,
) -> tuple[list[WordVerdict], float]:
    sens = resolve_mode(mode)
    ref = tokenize(reference)
    hyp = apply_spelling(tokenize(hypothesis))
    # Also normalize spelling-table output (may reintroduce همزة forms)
    hyp = [normalize_arabic(t) for t in hyp]
    ref = [normalize_arabic(t) for t in ref]

    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    bp: list[list[Optional[str]]] = [[None] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0], bp[i][0] = i, "D"
    for j in range(1, m + 1):
        dp[0][j], bp[0][j] = j, "I"
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if tokens_match(ref[i - 1], hyp[j - 1], sens):
                dp[i][j], bp[i][j] = dp[i - 1][j - 1], "M"
            else:
                costs = (
                    (dp[i - 1][j] + 1, "D"),
                    (dp[i][j - 1] + 1, "I"),
                    (dp[i - 1][j - 1] + 1, "S"),
                )
                dp[i][j], bp[i][j] = min(costs, key=lambda x: x[0])

    verdicts: list[WordVerdict] = []
    i, j = n, m
    while i > 0 or j > 0:
        op = bp[i][j]
        if op == "M":
            verdicts.append(
                WordVerdict(ErrorType.MATCH, i - 1, j - 1, ref[i - 1], hyp[j - 1])
            )
            i, j = i - 1, j - 1
        elif op == "S":
            verdicts.append(
                WordVerdict(
                    ErrorType.SUBSTITUTION, i - 1, j - 1, ref[i - 1], hyp[j - 1]
                )
            )
            i, j = i - 1, j - 1
        elif op == "D":
            verdicts.append(
                WordVerdict(ErrorType.DELETION, i - 1, None, ref[i - 1], None)
            )
            i -= 1
        elif op == "I":
            verdicts.append(
                WordVerdict(ErrorType.INSERTION, None, j - 1, None, hyp[j - 1])
            )
            j -= 1
        else:
            break
    verdicts.reverse()
    wer = (dp[n][m] / max(n, 1)) if n else (0.0 if m == 0 else 1.0)
    return verdicts, wer


def build_error_log(
    surah: int,
    ayah: int,
    reference: str,
    hypothesis: str,
    mode: Optional[str] = None,
) -> dict:
    sens = resolve_mode(mode)
    verdicts, wer = align_words(reference, hypothesis, mode=sens.key)
    errors = [
        {
            "type": v.type.value,
            "ref_index": v.ref_index,
            "hyp_index": v.hyp_index,
            "ref_token": v.ref_token,
            "hyp_token": v.hyp_token,
        }
        for v in verdicts
        if v.type != ErrorType.MATCH
    ]
    words = [
        {
            "ref_index": v.ref_index,
            "ref_token": v.ref_token,
            "status": "ok" if v.type == ErrorType.MATCH else v.type.value,
            "hyp_token": v.hyp_token,
        }
        for v in verdicts
        if v.ref_index is not None or v.type == ErrorType.INSERTION
    ]
    perfect = len(errors) == 0
    if perfect:
        message_ar = "أحسنت، بارك الله فيك"
    elif sens.key == "child":
        message_ar = "حاول مرة أخرى بهدوء — أنت قريب"
    else:
        message_ar = "أعد الكلمات المحددة بهدوء"
    return {
        "surah": surah,
        "ayah": ayah,
        "reference": reference,
        "hypothesis": hypothesis,
        "mode": sens.key,
        "mode_ar": sens.label_ar,
        "wer": round(wer, 4),
        "perfect": perfect,
        "message_ar": message_ar,
        "errors": errors,
        "words": words,
    }
