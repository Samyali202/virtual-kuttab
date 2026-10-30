"""Muallim karaoke timings: first-pass speech + repeat loops (pause-safe)."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf


def load_mp3_16k(path: Path) -> tuple[np.ndarray, float]:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tout:
        out = tout.name
    try:
        proc = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(path),
                "-ac",
                "1",
                "-ar",
                "16000",
                "-f",
                "wav",
                out,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr[-500:] if proc.stderr else "ffmpeg failed")
        audio, sr = sf.read(out, dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        return audio.astype(np.float32), float(len(audio) / float(sr))
    finally:
        Path(out).unlink(missing_ok=True)


def _group_token_words(tokens: list[str], timestamps: list[float]) -> list[tuple[str, float, float]]:
    words: list[tuple[str, float, float]] = []
    cur: list[str] = []
    cur_t: list[float] = []
    for tok, t in zip(tokens, timestamps):
        if tok == " " or tok == "▁":
            if cur:
                words.append(("".join(cur), cur_t[0], cur_t[-1]))
            cur, cur_t = [], []
        else:
            cur.append(tok)
            cur_t.append(float(t))
    if cur:
        words.append(("".join(cur), cur_t[0], cur_t[-1]))
    return words


def _frame_rms(
    samples: np.ndarray,
    sr: int = 16000,
    frame_ms: float = 25.0,
    hop_ms: float = 10.0,
) -> tuple[np.ndarray, int, int]:
    frame = max(1, int(sr * frame_ms / 1000.0))
    hop = max(1, int(sr * hop_ms / 1000.0))
    n = 1 + max(0, (len(samples) - frame) // hop)
    rms = np.empty(n, dtype=np.float64)
    for i in range(n):
        seg = samples[i * hop : i * hop + frame]
        rms[i] = float(np.sqrt(np.mean(seg * seg) + 1e-12))
    return rms, frame, hop


def _split_island_on_valleys(
    samples: np.ndarray,
    start: float,
    end: float,
    *,
    sr: int = 16000,
    min_valley: float = 0.65,
    min_speech: float = 0.18,
) -> list[tuple[float, float]]:
    """
    Split one island where the sheikh goes quiet relative to that phrase.

    Global VAD often keeps soft teaching pauses inside a 'speech' island
    (room tone still above the floor). Relative valleys ≥ min_valley are real
    pauses — karaoke must not march words across them.
    """
    a = max(0, int(start * sr))
    b = min(len(samples), int(end * sr))
    seg = samples[a:b]
    if seg.size < int(sr * min_speech):
        return [(start, end)] if end - start >= min_speech else []

    rms, frame, hop = _frame_rms(seg, sr=sr)
    if rms.size < 8:
        return [(start, end)]

    peak = float(np.percentile(rms, 90))
    floor = float(np.percentile(rms, 20))
    # Strict quiet gate — soft madd / elongated letters must stay voiced
    thr = max(floor * 2.0, peak * 0.06, 1e-4)
    voiced = rms >= thr

    # Find quiet runs ≥ min_valley, then keep voiced spans between them
    quiet_runs: list[tuple[int, int]] = []
    i = 0
    while i < len(voiced):
        if voiced[i]:
            i += 1
            continue
        j = i
        while j < len(voiced) and not voiced[j]:
            j += 1
        if (j - i) * hop / sr >= min_valley:
            quiet_runs.append((i, j))
        i = j

    if not quiet_runs:
        return [(start, end)] if end - start >= min_speech else []

    pieces: list[tuple[float, float]] = []
    cursor = 0
    for qi, qj in quiet_runs:
        if qi > cursor:
            ps = start + cursor * hop / sr
            pe = min(end, start + (qi * hop + frame) / sr)
            if pe - ps >= min_speech:
                pieces.append((ps, pe))
        cursor = qj
    if cursor < len(voiced):
        ps = start + cursor * hop / sr
        pe = end
        if pe - ps >= min_speech:
            pieces.append((ps, pe))
    return pieces if pieces else ([(start, end)] if end - start >= min_speech else [])


def find_speech_intervals(
    samples: np.ndarray,
    sr: int = 16000,
    frame_ms: float = 25.0,
    hop_ms: float = 10.0,
    min_speech: float = 0.15,
    min_pause: float = 0.28,
) -> list[tuple[float, float]]:
    """Speech islands separated by Muallim teaching pauses (incl. soft pauses)."""
    if samples.size == 0:
        return []
    rms, frame, hop = _frame_rms(samples, sr=sr, frame_ms=frame_ms, hop_ms=hop_ms)
    floor = float(np.percentile(rms, 15))
    peak = float(np.percentile(rms, 90))
    thr = max(floor * 2.7, floor + 0.22 * (peak - floor), 1e-4)
    speech = rms >= thr

    max_hole = max(1, int(min_pause / (hop_ms / 1000.0)) - 1)
    padded = speech.copy()
    i = 0
    while i < len(padded):
        if padded[i]:
            i += 1
            continue
        j = i
        while j < len(padded) and not padded[j]:
            j += 1
        if 0 < i and j < len(padded) and (j - i) <= max_hole:
            padded[i:j] = True
        i = j

    coarse: list[tuple[float, float]] = []
    i = 0
    while i < len(padded):
        if not padded[i]:
            i += 1
            continue
        j = i
        while j < len(padded) and padded[j]:
            j += 1
        start = i * hop / sr
        end = min(len(samples) / sr, (j * hop + frame) / sr)
        if end - start >= min_speech:
            coarse.append((start, end))
        i = j

    # Second pass: cut only clear teaching pauses (≥1.3s quiet) inside islands
    out: list[tuple[float, float]] = []
    for s, e in coarse:
        out.extend(
            _split_island_on_valleys(
                # Keep ≥1.2s so phrase islands stay whole for replay pairing.
                # Soft pauses inside a phrase are cleared live by the UI energy gate.
                samples, s, e, sr=sr, min_valley=1.20, min_speech=min_speech
            )
        )
    return out


def _letter_weights(n: int) -> list[float]:
    return [1.0] * max(1, n)


def _allocate_counts(n_words: int, island_durs: list[float]) -> list[int]:
    if n_words <= 0 or not island_durs:
        return []
    total = sum(island_durs) or 1.0
    raw = [n_words * (d / total) for d in island_durs]
    counts = [max(1, int(round(x))) for x in raw]
    while sum(counts) > n_words:
        i = max(range(len(counts)), key=lambda k: counts[k])
        if counts[i] > 1:
            counts[i] -= 1
        else:
            break
    while sum(counts) < n_words:
        i = max(range(len(counts)), key=lambda k: island_durs[k] / counts[k])
        counts[i] += 1
    return counts


def _dur(isle: tuple[float, float]) -> float:
    return max(0.05, isle[1] - isle[0])


def _filter_noise_islands(
    islands: list[tuple[float, float]],
    *,
    min_dur: float = 0.35,
) -> list[tuple[float, float]]:
    """Drop click/breath blips — keep short real phrases (Muallim openings)."""
    if not islands:
        return []
    durs = [_dur(x) for x in islands]
    med = float(sorted(durs)[len(durs) // 2])
    # Floor stays low so 0.4–0.8s opening words are not discarded
    floor = max(min_dur, min(0.55, 0.12 * med))
    kept = [x for x in islands if _dur(x) >= floor]
    return kept if kept else list(islands)


def _rms_envelope(
    samples: np.ndarray,
    sr: int,
    start: float,
    end: float,
    *,
    hop_ms: float = 20.0,
) -> np.ndarray:
    a = max(0, int(start * sr))
    b = min(len(samples), int(end * sr))
    seg = samples[a:b]
    if seg.size == 0:
        return np.zeros(1, dtype=np.float64)
    hop = max(1, int(sr * hop_ms / 1000.0))
    n = max(1, len(seg) // hop)
    env = np.empty(n, dtype=np.float64)
    for i in range(n):
        chunk = seg[i * hop : (i + 1) * hop]
        env[i] = float(np.sqrt(np.mean(chunk * chunk) + 1e-12))
    return env


def _envelope_corr(a: np.ndarray, b: np.ndarray) -> float:
    """Pearson correlation of two envelopes resampled to the same length."""
    if a.size < 3 or b.size < 3:
        return 0.0
    n = int(max(a.size, b.size))
    n = max(8, min(n, 256))
    xa = np.linspace(0.0, 1.0, a.size)
    xb = np.linspace(0.0, 1.0, b.size)
    x = np.linspace(0.0, 1.0, n)
    aa = np.interp(x, xa, a)
    bb = np.interp(x, xb, b)
    aa = aa - aa.mean()
    bb = bb - bb.mean()
    denom = float(np.sqrt(np.sum(aa * aa) * np.sum(bb * bb))) + 1e-12
    return float(np.sum(aa * bb) / denom)


def pair_muallim_islands(
    islands: list[tuple[float, float]],
    samples: np.ndarray | None = None,
    sr: int = 16000,
) -> tuple[list[tuple[float, float]], list[dict[str, float]]]:
    """
    Split speech into first-pass islands + optional replay remaps.

    Muallim re-reads are detected by duration + size (RMS corr is unreliable —
    sheikh pacing changes on the second pass):

    - teaching pause ≥ 2.0s
    - duration within 0.82–1.22×
    - EACH island ≥ 28% of total cleaned speech (major chunk re-read)

    Phrase-by-phrase lessons (Ayat al-Kursi) keep short sequential islands
    (<28% each) so equal-length neighbors are not false-paired.
    Optional coda: much shorter trailing island after a major first-pass,
    confirmed with weak envelope corr when samples are available.
    """
    cleaned = _filter_noise_islands(islands)
    if not cleaned:
        return [], []
    if len(cleaned) == 1:
        return cleaned, []

    speech_total = sum(_dur(x) for x in cleaned) or 1.0

    def is_replay(a: tuple[float, float], b: tuple[float, float], gap: float) -> str | None:
        if gap < 2.0:
            return None
        da, db = _dur(a), _dur(b)
        if db <= 0:
            return None
        ratio = da / db
        frac_a = da / speech_total
        frac_b = db / speech_total
        # Major chunk re-read (full ayah or long phrase taught twice)
        if 0.70 <= ratio <= 1.35 and frac_a >= 0.28 and frac_b >= 0.28:
            return "full"
        # Short coda / echo of the end of `a`
        if ratio >= 1.55 and db >= 0.7 and frac_a >= 0.35 and gap >= 2.0:
            return "coda"
        return None

    firsts: list[tuple[float, float]] = []
    replays: list[dict[str, float]] = []
    i = 0
    while i < len(cleaned):
        a = cleaned[i]
        firsts.append(a)
        i += 1
        da = _dur(a)
        saw_full_replay = False
        while i < len(cleaned):
            b = cleaned[i]
            gap = b[0] - cleaned[i - 1][1]
            kind = is_replay(a, b, gap)
            # After a confirmed full re-read, shorter leftover islands are
            # more passes of the same phrase (not new words). Do not swallow
            # a following phrase-block that is itself as long as `a`.
            if (
                kind is None
                and saw_full_replay
                and gap >= 2.0
                and _dur(b) >= 0.7
            ):
                rest_dur = sum(_dur(x) for x in cleaned[i:])
                if rest_dur <= 0.85 * da:
                    kind = "coda" if da / _dur(b) >= 1.15 else "full"
            if kind == "full":
                replays.append(
                    {
                        "audio_start": round(b[0], 3),
                        "audio_end": round(b[1], 3),
                        "ref_start": round(a[0], 3),
                        "ref_end": round(a[1], 3),
                    }
                )
                saw_full_replay = True
                i += 1
                continue
            if kind == "coda":
                replays.append(
                    {
                        "audio_start": round(b[0], 3),
                        "audio_end": round(b[1], 3),
                        "ref_start": round(a[0] + 0.55 * da, 3),
                        "ref_end": round(a[1], 3),
                    }
                )
                i += 1
                continue
            break
    return firsts, replays


def timings_from_islands(
    islands: list[tuple[float, float]],
    duration_sec: float,
    n_words: int,
    weights: list[float] | None = None,
    *,
    hold_through_end: bool = False,
    lead_sec: float = 0.08,
) -> list[dict[str, float | int]]:
    """
    Place words inside speech islands only — never across teaching pauses.

    Long gaps between islands stay as gaps (no active word). Only micro-gaps
    (<0.25s, breath) are closed for smooth karaoke. Applies a small lead so
    highlight is not late.
    """
    if n_words <= 0 or not islands:
        return []
    durs = [_dur(x) for x in islands]
    counts = _allocate_counts(n_words, durs)
    wts = weights if weights and len(weights) == n_words else _letter_weights(n_words)

    out: list[dict[str, float | int]] = []
    wi = 0
    speech_end = islands[-1][1]
    micro_gap = 0.25
    for ii, (isle_s, isle_e) in enumerate(islands):
        c = counts[ii] if ii < len(counts) else 0
        if c <= 0:
            continue
        chunk_w = wts[wi : wi + c]
        tw = sum(chunk_w) or 1.0
        # Never stretch into a teaching pause. Only bridge tiny breath gaps.
        if ii + 1 < len(islands) and (islands[ii + 1][0] - isle_e) <= micro_gap:
            hold_until = islands[ii + 1][0]
        elif hold_through_end and ii == len(islands) - 1:
            hold_until = duration_sec
        else:
            hold_until = isle_e

        t = isle_s
        for j, w in enumerate(chunk_w):
            dur = (isle_e - isle_s) * (w / tw)
            raw_start = t
            if j < c - 1:
                raw_end = t + dur
                t = raw_end
            else:
                raw_end = hold_until
                t = isle_e
            # Lead highlight slightly so it does not feel late vs speech
            start = max(0.0, raw_start - lead_sec)
            if out:
                # Do not pull the next island's first word back across a pause
                prev_end = float(out[-1]["end"])
                if start < prev_end:
                    start = prev_end
            end = max(start + 0.05, raw_end)
            out.append({"i": wi + j, "start": round(start, 3), "end": round(end, 3)})
        wi += c

    while len(out) < n_words:
        i = len(out)
        prev_end = float(out[-1]["end"]) if out else 0.0
        out.append({"i": i, "start": prev_end, "end": speech_end})

    if out:
        # Keep first word starting at/just before first speech — not t=0 silence
        out[0]["start"] = round(max(0.0, islands[0][0] - lead_sec), 3)
        if not hold_through_end:
            out[-1]["end"] = round(max(float(out[-1]["start"]) + 0.05, speech_end), 3)
        # Close only micro-gaps (breath). Keep teaching pauses as real gaps.
        for i in range(len(out) - 1):
            gap = float(out[i + 1]["start"]) - float(out[i]["end"])
            if 0 < gap <= micro_gap:
                out[i]["end"] = out[i + 1]["start"]
            elif gap < 0:
                out[i]["end"] = out[i + 1]["start"]
    return out[:n_words]


def _pause_list(islands: list[tuple[float, float]]) -> list[tuple[float, float]]:
    pauses: list[tuple[float, float]] = []
    if not islands:
        return pauses
    if islands[0][0] > 0.05:
        pauses.append((0.0, islands[0][0]))
    for a, b in zip(islands, islands[1:]):
        if b[0] - a[1] > 0.05:
            pauses.append((a[1], b[0]))
    return pauses


def _snap_out_of_pause(t: float, pauses: list[tuple[float, float]]) -> float:
    for ps, pe in pauses:
        if ps - 0.05 <= t < pe:
            return pe
    return t


def _cut_end_at_pause(
    start: float, end: float, pauses: list[tuple[float, float]]
) -> float:
    for ps, pe in pauses:
        if (pe - ps) > 0.25 and start < ps + 0.05 <= end:
            return max(start + 0.05, ps)
    return end


def timings_from_asr_snapped(
    grouped: list[tuple[str, float, float]],
    islands: list[tuple[float, float]],
    duration_sec: float,
    n_words: int | None = None,
    lead_sec: float = 0.04,
) -> list[dict[str, float | int]]:
    """ASR starts snapped out of pauses; trim to speech end (no trailing stretch)."""
    if not grouped:
        return []
    pauses = _pause_list(islands)

    # If ASR heard ~2× words (full repeat), keep the first copy only
    use = grouped
    if n_words and len(grouped) >= int(n_words * 1.6):
        use = grouped[:n_words]

    starts = [_snap_out_of_pause(max(0.0, use[0][1] - lead_sec), pauses)]
    for g in use[1:]:
        starts.append(_snap_out_of_pause(max(0.0, g[1] - lead_sec), pauses))
    for i in range(1, len(starts)):
        if starts[i] < starts[i - 1] + 0.04:
            starts[i] = starts[i - 1] + 0.04

    speech_end = islands[-1][1] if islands else duration_sec
    out: list[dict[str, float | int]] = []
    for i, start in enumerate(starts):
        if i + 1 < len(starts):
            end = _cut_end_at_pause(start, starts[i + 1], pauses)
        else:
            end = speech_end
        out.append({"i": i, "start": round(start, 3), "end": round(max(start + 0.05, end), 3)})
    if n_words and len(out) > n_words:
        out = out[:n_words]
        out[-1]["end"] = round(speech_end, 3)
    return out


def _expand_point_timestamps(
    words: list[dict[str, float | int]],
    pauses: list[tuple[float, float]],
    speech_end: float,
    *,
    min_dur: float = 0.18,
) -> None:
    """In-place fix: ASR often emits ~50ms point stamps; stretch to audible spans."""
    n = len(words)
    if n == 0:
        return

    def _pause_limit(start: float, limit: float) -> float:
        for ps, pe in pauses:
            if (pe - ps) >= 0.35 and start < ps < limit:
                return ps
        return limit

    # Pass 1: isolated / spaced shorts — extend toward next word (cap into silence)
    for i in range(n):
        s = float(words[i]["start"])
        e = float(words[i]["end"])
        if e - s >= min_dur:
            continue
        next_s = float(words[i + 1]["start"]) if i + 1 < n else speech_end
        limit = _pause_limit(s, next_s)
        if limit == next_s and next_s - s <= 0.95:
            new_end = next_s
        else:
            new_end = min(limit, s + 0.75)
        if new_end < s + min_dur:
            new_end = min(max(limit, s + 0.05), s + min_dur) if limit > s else s + 0.05
        words[i]["end"] = round(max(e, new_end), 3)

    for i in range(n - 1):
        if float(words[i]["end"]) > float(words[i + 1]["start"]):
            words[i]["end"] = words[i + 1]["start"]

    # Pass 2: packed short clusters — redistribute (steal from neighbor if needed)
    i = 0
    while i < n:
        dur_i = float(words[i]["end"]) - float(words[i]["start"])
        if dur_i >= min_dur:
            i += 1
            continue
        j = i + 1
        while j < n:
            gap = float(words[j]["start"]) - float(words[j - 1]["end"])
            dur_j = float(words[j]["end"]) - float(words[j]["start"])
            if gap > 0.15 or dur_j >= min_dur:
                break
            j += 1
        count = j - i
        run_start = float(words[i]["start"])
        limit = float(words[j]["start"]) if j < n else speech_end
        limit = _pause_limit(run_start, limit)
        need = min_dur * count
        span = limit - run_start
        # Never steal across a teaching pause (that stretched 10:2 عبر الصمت).
        gap_prev = run_start - float(words[i - 1]["end"]) if i > 0 else 999.0
        if span < need and i > 0 and gap_prev <= 0.15:
            prev_s = float(words[i - 1]["start"])
            prev_e = float(words[i - 1]["end"])
            steal = min(max(0.0, prev_e - prev_s - min_dur), need - span)
            if steal > 0.04:
                words[i - 1]["end"] = round(prev_e - steal, 3)
                run_start = float(words[i - 1]["end"])
                span = limit - run_start
        gap_next = (
            float(words[j]["start"]) - float(words[j - 1]["end"]) if j < n else 999.0
        )
        if span < need and j < n and gap_next <= 0.15:
            nxt_s = float(words[j]["start"])
            nxt_e = float(words[j]["end"])
            steal = min(max(0.0, nxt_e - nxt_s - min_dur), need - span)
            if steal > 0.04:
                words[j]["start"] = round(nxt_s + steal, 3)
                limit = float(words[j]["start"])
                span = limit - run_start
        # If still spanning silence, keep the cluster local
        if span > max(need * 1.5, 1.0):
            span = min(need * 1.25, 0.75 * count)
            limit = run_start + span
            if j < n:
                limit = min(limit, float(words[j]["start"]))
                span = limit - run_start
        if span <= 0.05:
            i = j
            continue
        span = max(span, min(need, span + 0.01))
        if j < n:
            span = min(span, float(words[j]["start"]) - run_start)
        for k in range(count):
            t0 = run_start + span * (k / count)
            t1 = run_start + span * ((k + 1) / count)
            words[i + k]["start"] = round(t0, 3)
            words[i + k]["end"] = round(max(t0 + 0.05, t1), 3)
        i = j


def timings_from_forced_align(
    grouped: list[tuple[str, float, float]],
    reference_text: str,
    islands: list[tuple[float, float]],
    duration_sec: float,
    *,
    lead_sec: float = 0.04,
    min_coverage: float = 0.55,
) -> list[dict[str, float | int]] | None:
    """
    Map ASR token-word timestamps onto pinned reference words via Levenshtein.

    This is the karaoke 'forced align' path: text is known; we transfer times,
    never invent words. Returns None if coverage is too low (caller falls back).
    """
    if not grouped or not reference_text.strip():
        return None

    # Import locally to avoid circular imports at module load in some runners
    from align import ErrorType, align_words, tokenize

    hyp_text = " ".join(g[0] for g in grouped)
    ref_toks = tokenize(reference_text)
    if not ref_toks:
        return None

    # Drop ASR words that fall after first-pass speech (repeat bleed)
    speech_end = islands[-1][1] if islands else duration_sec
    use = [g for g in grouped if float(g[1]) <= speech_end + 0.35]
    if not use:
        use = grouped
    # If still ~2× ref (full re-read inside window), keep first copy
    if len(use) >= int(len(ref_toks) * 1.6):
        use = use[: len(ref_toks)]

    hyp_text = " ".join(g[0] for g in use)
    verdicts, _wer = align_words(reference_text, hyp_text, mode="beginner")

    # ref_index -> (start, end) from matched/substituted hyp words
    placed: dict[int, tuple[float, float]] = {}
    matched = 0
    for v in verdicts:
        if v.ref_index is None:
            continue
        if v.type in (ErrorType.MATCH, ErrorType.SUBSTITUTION) and v.hyp_index is not None:
            if 0 <= v.hyp_index < len(use):
                _w, s, e = use[v.hyp_index]
                placed[v.ref_index] = (float(s), float(e))
                matched += 1

    coverage = matched / max(len(ref_toks), 1)
    if coverage < min_coverage:
        return None

    pauses = _pause_list(islands)
    # Interpolate missing ref words between neighbors
    times: list[tuple[float, float] | None] = [None] * len(ref_toks)
    for i, se in placed.items():
        times[i] = se

    # Fill deletions by linear interpolation between known anchors
    known = sorted(placed.keys())
    for i in range(len(ref_toks)):
        if times[i] is not None:
            continue
        prev = next((k for k in reversed(known) if k < i), None)
        nxt = next((k for k in known if k > i), None)
        if prev is not None and nxt is not None:
            ps, pe = placed[prev]
            ns, ne = placed[nxt]
            # place evenly in the gap between prev.end and next.start
            gap0, gap1 = pe, ns
            if gap1 <= gap0 + 0.05:
                gap0, gap1 = ps, ne
            span = max(0.05, gap1 - gap0)
            slots = nxt - prev
            k = i - prev
            t0 = gap0 + span * ((k - 0.85) / slots)
            t1 = gap0 + span * (k / slots)
            times[i] = (max(0.0, t0), max(t0 + 0.05, t1))
        elif prev is not None:
            ps, pe = placed[prev]
            times[i] = (pe, min(speech_end, pe + 0.35))
        elif nxt is not None:
            ns, ne = placed[nxt]
            times[i] = (max(0.0, ns - 0.35), ns)
        else:
            return None

    out: list[dict[str, float | int]] = []
    for i, se in enumerate(times):
        assert se is not None
        raw_s, raw_e = se
        start = _snap_out_of_pause(max(0.0, raw_s - lead_sec), pauses)
        end = max(start + 0.05, raw_e)
        end = _cut_end_at_pause(start, end, pauses)
        if out and start < float(out[-1]["end"]):
            # keep monotonic; allow tiny overlap fix
            start = float(out[-1]["end"])
            if end <= start:
                end = start + 0.05
        out.append({"i": i, "start": round(start, 3), "end": round(end, 3)})

    # Ensure teaching pauses stay as gaps between words
    for i in range(len(out) - 1):
        gap = float(out[i + 1]["start"]) - float(out[i]["end"])
        if gap < 0:
            out[i]["end"] = out[i + 1]["start"]
        elif 0 < gap <= 0.2:
            out[i]["end"] = out[i + 1]["start"]
        else:
            # long gap: clamp current end away from next start if ASR bled
            for ps, pe in pauses:
                if float(out[i]["start"]) < ps <= float(out[i]["end"]) and pe <= float(
                    out[i + 1]["start"]
                ) + 0.05:
                    out[i]["end"] = round(max(float(out[i]["start"]) + 0.05, ps), 3)
                    break

    if out:
        out[-1]["end"] = round(
            max(float(out[-1]["start"]) + 0.05, min(float(out[-1]["end"]), speech_end)),
            3,
        )
    _expand_point_timestamps(out, pauses, speech_end, min_dur=0.18)
    return out


def asr_collapsed_before_pause(
    grouped: list[tuple[str, float, float]],
    islands: list[tuple[float, float]],
) -> bool:
    if len(islands) < 2 or not grouped:
        return False
    last_ts = grouped[-1][2]
    return last_ts < islands[-1][0] - 0.3


def retimes_by_island_assignment(
    rough: list[dict[str, float | int]],
    islands: list[tuple[float, float]],
    weights: list[float] | None = None,
    *,
    lead_sec: float = 0.06,
) -> list[dict[str, float | int]] | None:
    """
    Keep ASR forced-align only for *which island* each word belongs to.
    Re-time words inside each island by letter weight — Muallim karaoke
    needs pause-safe spans more than ASR millisecond stamps (often wrong).
    """
    if not rough or not islands:
        return None
    n = len(rough)
    wts = weights if weights and len(weights) == n else _letter_weights(n)

    def island_for(mid: float) -> int:
        for j, (s, e) in enumerate(islands):
            if s - 0.05 <= mid <= e + 0.05:
                return j
        # nearest island
        best_j, best_d = 0, 1e9
        for j, (s, e) in enumerate(islands):
            if mid < s:
                d = s - mid
            elif mid > e:
                d = mid - e
            else:
                return j
            if d < best_d:
                best_d, best_j = d, j
        return best_j

    assign = [
        island_for((float(w["start"]) + float(w["end"])) / 2.0) for w in rough
    ]
    # Monotonic: words cannot jump backward across islands
    for i in range(1, n):
        if assign[i] < assign[i - 1]:
            assign[i] = assign[i - 1]

    out: list[dict[str, float | int] | None] = [None] * n
    for j, (isle_s, isle_e) in enumerate(islands):
        idxs = [i for i, a in enumerate(assign) if a == j]
        if not idxs:
            continue
        chunk_w = [wts[i] for i in idxs]
        tw = sum(chunk_w) or 1.0
        span = max(0.05, isle_e - isle_s)
        t = isle_s
        for k, i in enumerate(idxs):
            dur = span * (chunk_w[k] / tw)
            raw_start = t
            raw_end = isle_e if k == len(idxs) - 1 else t + dur
            t = raw_end
            start = max(0.0, raw_start - lead_sec)
            end = max(start + 0.05, raw_end)
            out[i] = {"i": i, "start": round(start, 3), "end": round(end, 3)}

    # Any hole (should be rare): place from previous end inside its island
    for i in range(n):
        if out[i] is not None:
            continue
        j = assign[i]
        isle_s, isle_e = islands[j]
        prev_end = float(out[i - 1]["end"]) if i and out[i - 1] else isle_s
        start = min(max(prev_end, isle_s), isle_e - 0.05)
        out[i] = {"i": i, "start": round(start, 3), "end": round(min(isle_e, start + 0.25), 3)}

    final: list[dict[str, float | int]] = [w for w in out if w is not None]  # type: ignore[misc]
    if len(final) != n:
        return None
    # Enforce monotonic + keep teaching gaps between islands
    micro = 0.25
    for i in range(n - 1):
        if float(final[i]["end"]) > float(final[i + 1]["start"]):
            final[i]["end"] = final[i + 1]["start"]
        gap = float(final[i + 1]["start"]) - float(final[i]["end"])
        # same-island micro breath only
        if 0 < gap <= micro and assign[i] == assign[i + 1]:
            final[i]["end"] = final[i + 1]["start"]
    return final


def build_muallim_timings(
    samples: np.ndarray,
    duration_sec: float,
    n_ref_words: int,
    word_weights: list[float] | None = None,
    recognizer: Any | None = None,
    reference_text: str | None = None,
) -> dict[str, Any]:
    """Primary Muallim karaoke: ASR assigns words→islands, weights time inside."""
    islands = find_speech_intervals(samples)
    firsts, replays = pair_muallim_islands(islands, samples=samples, sr=16000)

    # Decode each first-pass island on its own (skips replay audio between them).
    place_islands = firsts or islands
    grouped: list[tuple[str, float, float]] = []
    if recognizer is not None and place_islands:
        sr = 16000
        for isle_s, isle_e in place_islands:
            a = max(0, int(isle_s * sr))
            b = min(len(samples), int(isle_e * sr) + 1600)
            if b - a < sr // 5:
                continue
            stream = recognizer.create_stream()
            stream.accept_waveform(sr, samples[a:b])
            recognizer.decode_stream(stream)
            result = stream.result
            tokens = list(result.tokens or [])
            timestamps = list(result.timestamps or [])
            if not tokens or not timestamps or len(tokens) != len(timestamps):
                continue
            # Timestamps are relative to the island clip — shift to file time
            for w, t0, t1 in _group_token_words(tokens, timestamps):
                grouped.append((w, float(t0) + isle_s, float(t1) + isle_s))

    words: list[dict[str, float | int]] = []
    source = "energy-first-pass"

    # Preferred: ASR forced-align for island membership, then letter-weight
    # retiming inside each speech island (pause-safe karaoke).
    if grouped and reference_text:
        forced = timings_from_forced_align(
            grouped,
            reference_text,
            place_islands,
            duration_sec,
            lead_sec=0.04,
            min_coverage=0.50,
        )
        if forced and len(forced) == n_ref_words:
            snapped = retimes_by_island_assignment(
                forced, place_islands, weights=word_weights, lead_sec=0.06
            )
            if snapped and len(snapped) == n_ref_words:
                words = snapped
                source = "asr-island-weight"
            else:
                words = forced
                source = "asr-forced-align"

    if not words and grouped and n_ref_words and abs(len(grouped) - n_ref_words) <= 1:
        words = timings_from_asr_snapped(
            grouped, place_islands, duration_sec, n_words=n_ref_words, lead_sec=0.04
        )
        source = "asr-first-pass"

    if not words and n_ref_words > 0 and place_islands:
        words = timings_from_islands(
            place_islands,
            duration_sec,
            n_ref_words,
            weights=word_weights,
            hold_through_end=False,
        )
        source = "energy-first-pass"

    speech_end = float(words[-1]["end"]) if words else (
        place_islands[-1][1] if place_islands else duration_sec
    )

    # Safety: register a re-read after the opening block when pair_muallim missed it
    if place_islands and islands and not replays:
        block = (place_islands[0][0], place_islands[-1][1])
        da = _dur(block)
        for isle in islands:
            if isle[0] < place_islands[-1][1] + 1.5:
                continue
            db = _dur(isle)
            if db <= 0:
                continue
            ratio = da / db
            if 0.70 <= ratio <= 1.35:
                replays.append(
                    {
                        "audio_start": round(isle[0], 3),
                        "audio_end": round(isle[1], 3),
                        "ref_start": round(block[0], 3),
                        "ref_end": round(block[1], 3),
                    }
                )
                break
            if ratio >= 1.55 and db >= 0.7:
                replays.append(
                    {
                        "audio_start": round(isle[0], 3),
                        "audio_end": round(isle[1], 3),
                        "ref_start": round(block[0] + 0.55 * da, 3),
                        "ref_end": round(block[1], 3),
                    }
                )
                break

    def _hush_minus_replays(gap_s: float, gap_e: float) -> list[dict[str, float]]:
        """Teaching hush with Muallim replay windows carved out."""
        spans = [(gap_s, gap_e)]
        for r in replays:
            rs, re = float(r["audio_start"]), float(r["audio_end"])
            next_spans: list[tuple[float, float]] = []
            for a, b in spans:
                if re <= a or rs >= b:
                    next_spans.append((a, b))
                    continue
                if rs > a:
                    next_spans.append((a, rs))
                if re < b:
                    next_spans.append((re, b))
            spans = next_spans
        return [
            {"start": round(a, 3), "end": round(b, 3)}
            for a, b in spans
            if b - a >= 0.35
        ]

    quiet_gaps: list[dict[str, float]] = []
    if place_islands:
        if place_islands[0][0] >= 0.35:
            quiet_gaps.extend(_hush_minus_replays(0.0, place_islands[0][0]))
        for a, b in zip(place_islands, place_islands[1:]):
            if b[0] - a[1] >= 0.35:
                quiet_gaps.extend(_hush_minus_replays(a[1], b[0]))
        if duration_sec - place_islands[-1][1] >= 0.45:
            quiet_gaps.extend(_hush_minus_replays(place_islands[-1][1], duration_sec))

        # Soft teaching beats inside a phrase island (do not re-split placement —
        # only mark hush so karaoke clears while the sheikh is quiet).
        for isle_s, isle_e in place_islands:
            pieces = _split_island_on_valleys(
                samples, isle_s, isle_e, sr=16000, min_valley=0.55, min_speech=0.12
            )
            if len(pieces) < 2:
                continue
            for a, b in zip(pieces, pieces[1:]):
                if b[0] - a[1] >= 0.45:
                    quiet_gaps.extend(_hush_minus_replays(a[1], b[0]))

    quiet_gaps.sort(key=lambda g: g["start"])

    # Never let a word span a hush window (that lights text during silence).
    if words and quiet_gaps:
        for w in words:
            ws, we = float(w["start"]), float(w["end"])
            for g in quiet_gaps:
                gs, ge = float(g["start"]), float(g["end"])
                if we <= gs + 0.01 or ws >= ge - 0.01:
                    continue
                if ws < gs and we > gs:
                    # spoken before pause → end at hush start
                    we = gs
                elif ws < ge and we > ge:
                    # started inside/before hush → resume after hush
                    ws = ge
                elif ws >= gs and we <= ge:
                    # fully inside hush → park just after it
                    ws = ge
                    we = ge + 0.18
            if we - ws < 0.12:
                we = ws + 0.18
            w["start"] = round(max(0.0, ws), 3)
            w["end"] = round(we, 3)
        for i in range(len(words) - 1):
            if float(words[i]["end"]) > float(words[i + 1]["start"]):
                mid = (
                    float(words[i]["start"]) + float(words[i + 1]["end"])
                ) / 2.0
                # keep order; don't invent overlap across a real hush
                if float(words[i + 1]["start"]) - float(words[i]["start"]) > 0.05:
                    words[i]["end"] = words[i + 1]["start"]
                else:
                    words[i]["end"] = round(mid, 3)
                    words[i + 1]["start"] = round(mid, 3)

    return {
        "duration_sec": round(duration_sec, 3),
        "speech_end": round(speech_end, 3),
        "source": source,
        "replays": replays,
        "quiet_gaps": quiet_gaps,
        "words": words,
    }


def timings_from_recognizer(
    recognizer: Any,
    samples: np.ndarray,
    duration_sec: float,
    n_ref_words: int | None = None,
    word_weights: list[float] | None = None,
) -> list[dict[str, float | int]]:
    """Back-compat: word list only."""
    n = n_ref_words or 0
    payload = build_muallim_timings(
        samples, duration_sec, n, word_weights=word_weights, recognizer=recognizer
    )
    return list(payload.get("words") or [])


def timings_for_mp3(
    recognizer: Any,
    mp3_path: Path,
    n_ref_words: int | None = None,
    reference_text: str | None = None,
) -> dict[str, Any]:
    samples, duration = load_mp3_16k(mp3_path)
    weights = None
    if reference_text:
        toks = [t for t in reference_text.split() if t]
        weights = [float(max(2, len(t))) for t in toks]
        if n_ref_words is None:
            n_ref_words = len(toks)
    return build_muallim_timings(
        samples,
        duration,
        n_ref_words or 0,
        word_weights=weights,
        recognizer=recognizer,
        reference_text=reference_text,
    )


def energy_only_for_mp3(mp3_path: Path, reference_text: str) -> dict[str, Any]:
    """No ASR — safe for long ayahs / low RAM."""
    samples, duration = load_mp3_16k(mp3_path)
    toks = [t for t in reference_text.split() if t]
    weights = [float(max(2, len(t))) for t in toks] if toks else None
    return build_muallim_timings(
        samples,
        duration,
        len(toks),
        word_weights=weights,
        recognizer=None,
        reference_text=reference_text,
    )
