"""Word-level Levenshtein aligner for Tarteel-style (non-tajweed) grading."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional

# Arabic diacritics + tatweel
_DIAC = re.compile(r"[\u064B-\u065F\u0670\u0640]")


class ErrorType(str, Enum):
    DELETION = "deletion"
    SUBSTITUTION = "substitution"
    INSERTION = "insertion"
    MATCH = "match"


@dataclass
class WordVerdict:
    type: ErrorType
    ref_index: Optional[int]
    hyp_index: Optional[int]
    ref_token: Optional[str]
    hyp_token: Optional[str]


def normalize_arabic(text: str, strip_diacritics: bool = True) -> str:
    text = unicodedata.normalize("NFC", (text or "").strip())
    text = text.replace("\ufeff", "").replace("\u200f", "").replace("\u200e", "")
    if strip_diacritics:
        text = _DIAC.sub("", text)
    # Common letter folds for robust matching
    text = (
        text.replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
        .replace("ى", "ي")
        .replace("ة", "ه")
    )
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str, strip_diacritics: bool = True) -> List[str]:
    n = normalize_arabic(text, strip_diacritics=strip_diacritics)
    return [t for t in n.split(" ") if t]


def align_words(reference: str, hypothesis: str) -> tuple[list[WordVerdict], float]:
    ref = tokenize(reference)
    hyp = tokenize(hypothesis)
    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    bp: list[list[Optional[str]]] = [[None] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0], bp[i][0] = i, "D"
    for j in range(1, m + 1):
        dp[0][j], bp[0][j] = j, "I"
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref[i - 1] == hyp[j - 1]:
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
) -> dict:
    verdicts, wer = align_words(reference, hypothesis)
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
    return {
        "surah": surah,
        "ayah": ayah,
        "reference": reference,
        "hypothesis": hypothesis,
        "wer": round(wer, 4),
        "perfect": perfect,
        "message_ar": "أحسنت، بارك الله فيك" if perfect else "أعد الكلمات المحددة بهدوء",
        "errors": errors,
        "words": words,
    }
