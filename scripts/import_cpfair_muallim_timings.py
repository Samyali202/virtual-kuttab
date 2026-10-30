"""
Import cpfair/quran-align Husary Muallim word timings into Supabase.

Listen karaoke SSoT — do NOT invent Muallim timings with energy/ASR.

Usage (repo root):
  python scripts/import_cpfair_muallim_timings.py --surah 10 --ayahs 1-5
  python scripts/import_cpfair_muallim_timings.py --all
  python scripts/import_cpfair_muallim_timings.py --surah 10 --ayahs 1-5 --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from fill_missing_timings import build_texts, http_json, update_timings  # noqa: E402
from seed_content import MP3_DIR, QURAN, R2_PUBLIC, load_env, sb_query  # noqa: E402

CPFAIR_JSON = ROOT / "content" / "timings" / "cpfair" / "Husary_Muallim_128kbps.json"
CONTENT_VERSION = "cpfair-2016-11-24"
SOURCE = "cpfair-quran-align"
QUIET_GAP_SEC = 0.45


def parse_ayah_range(spec: str) -> list[int]:
    out: list[int] = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def expand_segments(
    segments: list[list[int]],
    n_ref: int,
) -> list[dict[str, float | int]] | None:
    """Expand cpfair [w0, w1, start_ms, end_ms] into per-word seconds."""
    if not segments or n_ref <= 0:
        return None
    placed: dict[int, tuple[float, float]] = {}
    for seg in segments:
        if len(seg) < 4:
            return None
        w0, w1, start_ms, end_ms = int(seg[0]), int(seg[1]), int(seg[2]), int(seg[3])
        # Rare cpfair glitches: inverted or zero-length spans — normalize in place.
        if end_ms < start_ms:
            start_ms, end_ms = end_ms, start_ms
        if end_ms == start_ms:
            end_ms = start_ms + 50
        w0 = max(0, min(w0, n_ref))
        w1 = max(0, min(w1, n_ref))
        if w1 <= w0:
            continue
        t0, t1 = start_ms / 1000.0, end_ms / 1000.0
        count = w1 - w0
        span = t1 - t0
        for k in range(count):
            i = w0 + k
            s = t0 + span * (k / count)
            e = t0 + span * ((k + 1) / count)
            placed[i] = (s, e)

    # Fill rare cpfair omissions by splitting gaps between known neighbors
    # (still anchored to cpfair walls — not energy invention).
    known = sorted(placed.keys())
    if not known:
        return None

    # Edge omissions: stretch from first/last known walls.
    first_k, last_k = known[0], known[-1]
    if first_k > 0:
        wall = placed[first_k][0]
        slot = max(0.05, wall / first_k) if wall > 0 else 0.08
        for i in range(first_k):
            s = max(0.0, wall - slot * (first_k - i))
            e = max(s + 0.04, wall - slot * (first_k - i - 1))
            placed[i] = (s, e)
        known = sorted(placed.keys())
    if last_k < n_ref - 1:
        pe = placed[last_k][1]
        n_miss = n_ref - 1 - last_k
        slot = 0.12
        for j, i in enumerate(range(last_k + 1, n_ref)):
            s = pe + slot * j
            e = pe + slot * (j + 1)
            placed[i] = (s, e)
        known = sorted(placed.keys())

    for i in range(n_ref):
        if i in placed:
            continue
        prev = next((k for k in reversed(known) if k < i), None)
        nxt = next((k for k in known if k > i), None)
        if prev is None or nxt is None:
            return None
        pe = placed[prev][1]
        ns = placed[nxt][0]
        if ns <= pe + 0.02:
            mid = (placed[prev][0] + placed[nxt][1]) / 2
            pe, ns = mid, mid
        slots = nxt - prev
        k = i - prev
        s = pe + (ns - pe) * ((k - 0.85) / slots)
        e = pe + (ns - pe) * (k / slots)
        placed[i] = (max(0.0, s), max(s + 0.05, e))
        known = sorted(placed.keys())

    if len(placed) != n_ref:
        return None

    words: list[dict[str, float | int]] = []
    for i in range(n_ref):
        s, e = placed[i]
        if e <= s:
            e = s + 0.05
        words.append({"i": i, "start": round(s, 3), "end": round(e, 3)})

    for i in range(n_ref - 1):
        if float(words[i]["end"]) > float(words[i + 1]["start"]):
            words[i]["end"] = words[i + 1]["start"]
    return words


def quiet_gaps_from_words(
    words: list[dict[str, float | int]],
    duration_sec: float | None,
) -> list[dict[str, float]]:
    gaps: list[dict[str, float]] = []
    if not words:
        return gaps
    first_s = float(words[0]["start"])
    if first_s >= QUIET_GAP_SEC:
        gaps.append({"start": 0.0, "end": round(first_s, 3)})
    for a, b in zip(words, words[1:]):
        g = float(b["start"]) - float(a["end"])
        if g >= QUIET_GAP_SEC:
            gaps.append(
                {"start": round(float(a["end"]), 3), "end": round(float(b["start"]), 3)}
            )
    speech_end = float(words[-1]["end"])
    if duration_sec and duration_sec - speech_end >= QUIET_GAP_SEC:
        gaps.append({"start": round(speech_end, 3), "end": round(duration_sec, 3)})
    return gaps


def mp3_duration_sec(surah: int, ayah: int) -> float | None:
    """Fast duration via ffprobe (no full decode)."""
    import subprocess

    path = MP3_DIR / f"{surah:03d}{ayah:03d}.mp3"
    if not path.exists():
        return None
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0:
            return None
        return float(proc.stdout.strip())
    except Exception:
        return None


def build_payload(
    row: dict,
    n_ref: int,
    duration_sec: float | None,
) -> dict | None:
    segs = row.get("segments") or []
    words = expand_segments(segs, n_ref)
    if not words:
        return None
    speech_end = float(words[-1]["end"])
    if duration_sec and speech_end > duration_sec + 0.35:
        return None
    return {
        "source": SOURCE,
        "content_version": CONTENT_VERSION,
        "duration_sec": round(duration_sec, 3) if duration_sec else None,
        "speech_end": round(speech_end, 3),
        "words": words,
        "quiet_gaps": quiet_gaps_from_words(words, duration_sec),
        "replays": [],
        "cpfair_stats": row.get("stats") or {},
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--all", action="store_true", help="Import all 6236 ayahs")
    ap.add_argument("--surah", type=int, default=None)
    ap.add_argument("--ayahs", type=str, default=None, help="e.g. 1-5 or 1,2,3")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--skip-duration",
        action="store_true",
        help="Skip ffprobe (much faster bulk import; no trailing hush from file length)",
    )
    ap.add_argument(
        "--resume",
        action="store_true",
        help="Skip ayahs already stored as cpfair-quran-align",
    )
    ap.add_argument(
        "--sleep-ms",
        type=int,
        default=80,
        help="Pause between DB writes to avoid Supabase 429 (default 80)",
    )
    ap.add_argument(
        "--batch-size",
        type=int,
        default=25,
        help="Ayahs per SQL upsert (default 25; 1 = single-row via update_timings)",
    )
    args = ap.parse_args()

    if not CPFAIR_JSON.exists():
        raise SystemExit(f"Missing {CPFAIR_JSON} — download cpfair release first")

    rows = json.loads(CPFAIR_JSON.read_text(encoding="utf-8"))
    by_key = {(int(r["surah"]), int(r["ayah"])): r for r in rows}
    texts = build_texts(json.loads(QURAN.read_text(encoding="utf-8")))

    if args.all:
        jobs = sorted(by_key.keys())
    elif args.surah is not None and args.ayahs:
        jobs = [(args.surah, a) for a in parse_ayah_range(args.ayahs)]
    elif args.surah is not None:
        jobs = sorted(k for k in by_key if k[0] == args.surah)
    else:
        raise SystemExit("Pass --all or --surah N [--ayahs 1-5]")

    env = load_env()
    token = env["SUPABASE_ACCESS_TOKEN"]
    ref = env["NEXT_PUBLIC_SUPABASE_URL"].replace("https://", "").split(".")[0]

    already: set[tuple[int, int]] = set()
    if args.resume and not args.dry_run:
        existing = http_json(
            token,
            ref,
            "select surah, ayah from ayah_audio "
            f"where qari='husary_muallim_128kbps' "
            f"and timings_json->>'source'='{SOURCE}'",
        )
        already = {(int(r["surah"]), int(r["ayah"])) for r in existing}
        print(f"resume: skipping {len(already)} already-imported ayahs", flush=True)

    def is_retryable(msg: str) -> bool:
        return any(
            x in msg
            for x in (
                "429",
                "Too Many Requests",
                "timed out",
                "Timeout",
                "503",
                "502",
                "Connection",
            )
        )

    def write_batch_with_retry(
        batch: list[tuple[int, int, dict]],
    ) -> None:
        if not batch:
            return
        if args.batch_size <= 1:
            for surah, ayah, payload in batch:
                update_timings(token, ref, surah, ayah, payload)
            return
        values: list[str] = []
        for surah, ayah, payload in batch:
            js = json.dumps(payload, ensure_ascii=False).replace("'", "''")
            url = f"{R2_PUBLIC}/{surah:03d}{ayah:03d}.mp3"
            values.append(
                f"({surah},{ayah},'husary_muallim_128kbps','{url}','{js}'::jsonb)"
            )
        sql = (
            "insert into public.ayah_audio (surah, ayah, qari, audio_url, timings_json) values\n"
            + ",\n".join(values)
            + "\non conflict (surah, ayah, qari) do update set "
            "timings_json = excluded.timings_json, audio_url = excluded.audio_url;"
        )
        delay = 2.0
        for attempt in range(12):
            try:
                sb_query(token, ref, sql)
                return
            except Exception as e:
                msg = str(e)
                if not is_retryable(msg) or attempt == 11:
                    raise
                print(
                    f"  retry batch n={len(batch)} attempt={attempt + 1} "
                    f"sleep={delay:.1f}s err={msg[:120]}",
                    flush=True,
                )
                time.sleep(delay)
                delay = min(90.0, delay * 1.7)

    ok = fail = skipped = 0
    pending: list[tuple[int, int, dict]] = []
    batch_size = max(1, args.batch_size)

    def flush_pending() -> None:
        nonlocal ok, fail, pending
        if not pending:
            return
        try:
            write_batch_with_retry(pending)
            ok += len(pending)
        except Exception as e:
            # Fall back to single-row so one bad ayah does not sink the batch.
            print(f"  batch write failed ({e}); falling back to singles", flush=True)
            for surah, ayah, payload in pending:
                try:
                    update_timings(token, ref, surah, ayah, payload)
                    ok += 1
                except Exception as e2:
                    print(f"FAIL {surah}:{ayah} write {e2}", flush=True)
                    fail += 1
                    time.sleep(2.0)
        pending = []
        if args.sleep_ms > 0:
            time.sleep(args.sleep_ms / 1000.0)

    for surah, ayah in jobs:
        if (surah, ayah) in already:
            skipped += 1
            continue
        text = texts.get((surah, ayah), "")
        n_ref = len([w for w in text.split() if w])
        row = by_key.get((surah, ayah))
        if not row:
            print(f"FAIL {surah}:{ayah} missing in cpfair", flush=True)
            fail += 1
            continue
        dur = None if args.skip_duration else mp3_duration_sec(surah, ayah)
        payload = build_payload(row, n_ref, dur)
        if not payload:
            print(
                f"FAIL {surah}:{ayah} expand/mismatch "
                f"cpfair_segs={len(row.get('segments') or [])} ref_words={n_ref}",
                flush=True,
            )
            fail += 1
            continue
        n_gaps = len(payload["quiet_gaps"])
        print(
            f"OK {surah}:{ayah} words={len(payload['words'])} "
            f"speech_end={payload['speech_end']} quiet_gaps={n_gaps} "
            f"dur={payload.get('duration_sec')}",
            flush=True,
        )
        if args.dry_run:
            ok += 1
            continue
        if payload.get("duration_sec") is None:
            payload.pop("duration_sec", None)
        pending.append((surah, ayah, payload))
        if len(pending) >= batch_size:
            flush_pending()

    if not args.dry_run:
        flush_pending()

    print(
        f"\nDONE ok={ok} fail={fail} skipped={skipped} "
        f"dry_run={args.dry_run} source={SOURCE}",
        flush=True,
    )
    if fail:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
