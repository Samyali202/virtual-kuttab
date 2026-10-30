export type Ayah = { surah: number; ayah: number; text_uthmani: string };
export type AyahAudio = { surah: number; ayah: number; audio_url: string };

export { SURAH_META } from "./surah-meta";

export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

/** Eastern Arabic digits for mushaf-style ayah end marks (UI only — not in DB text). */
export function toArabicIndic(n: number): string {
  return String(Math.max(0, Math.floor(n)))
    .split("")
    .map((d) => ARABIC_INDIC[Number(d)] ?? d)
    .join("");
}

/**
 * Tanzil-style ayah end mark with Western digits (product choice):
 * LRM + ornate paren ﴿ + 1..n + ﴾ + RLM
 * (UI only — not part of downloaded uthmani / reference_text).
 */
export function tanzilAyahEndMark(n: number): string {
  return `\u200E\uFD3F${Math.max(0, Math.floor(n))}\uFD3E\u200F`;
}

export type WordTiming = { i: number; start: number; end: number };

/** Muallim repeat window: map audio time → first-pass timeline for karaoke loop. */
export type TimingReplay = {
  audio_start: number;
  audio_end: number;
  ref_start: number;
  ref_end: number;
};

export type QuietGap = { start: number; end: number };

export type ParsedTimings = {
  words: WordTiming[];
  replays: TimingReplay[];
  speechEnd: number;
  quietGaps: QuietGap[];
};

/** Prefer DB timings (cpfair-quran-align SSoT). Proportional fallback is last resort. */
export function parseTimingsJson(
  raw: unknown,
  wordCount: number,
  durationSec: number,
): ParsedTimings | null {
  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as {
    words?: unknown;
    replays?: unknown;
    speech_end?: unknown;
    quiet_gaps?: unknown;
  };
  const words = obj.words;
  if (!Array.isArray(words) || !words.length) return null;
  const out: WordTiming[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i] as { i?: number; start?: number; end?: number };
    const start = Number(w.start);
    const end = Number(w.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    out.push({ i: typeof w.i === "number" ? w.i : i, start, end });
  }
  // Word count mismatch → unusable for this ayah text
  if (wordCount > 0 && Math.abs(out.length - wordCount) > 1) return null;

  const speechEndRaw = Number(obj.speech_end);
  const speechEnd =
    Number.isFinite(speechEndRaw) && speechEndRaw > 0
      ? Math.min(durationSec || speechEndRaw, speechEndRaw)
      : out[out.length - 1]?.end ?? durationSec;

  // Close only micro-gaps (breath). Keep teaching pauses as real gaps so
  // karaoke goes dark while the sheikh is silent.
  const microGap = 0.25;
  for (let i = 0; i < out.length - 1; i++) {
    const gap = out[i + 1].start - out[i].end;
    if (gap < 0 || (gap > 0 && gap <= microGap)) {
      out[i].end = out[i + 1].start;
    }
  }
  // Do NOT stretch last word across trailing Muallim silence / file padding
  if (out.length) {
    out[out.length - 1].end = Math.max(out[out.length - 1].start + 0.05, speechEnd);
  }

  const replays: TimingReplay[] = [];
  if (Array.isArray(obj.replays)) {
    for (const r of obj.replays) {
      const rr = r as Record<string, unknown>;
      const audio_start = Number(rr.audio_start);
      const audio_end = Number(rr.audio_end);
      const ref_start = Number(rr.ref_start);
      const ref_end = Number(rr.ref_end);
      if (
        [audio_start, audio_end, ref_start, ref_end].every(Number.isFinite) &&
        audio_end > audio_start &&
        ref_end > ref_start
      ) {
        replays.push({ audio_start, audio_end, ref_start, ref_end });
      }
    }
  }

  // Teaching pauses from builder; also derive from word gaps as fallback
  const quietGaps: QuietGap[] = [];
  if (Array.isArray(obj.quiet_gaps)) {
    for (const g of obj.quiet_gaps) {
      const gg = g as Record<string, unknown>;
      const start = Number(gg.start);
      const end = Number(gg.end);
      if (Number.isFinite(start) && Number.isFinite(end) && end - start >= 0.35) {
        quietGaps.push({ start, end });
      }
    }
  }
  if (!quietGaps.length) {
    for (let i = 0; i < out.length - 1; i++) {
      const gap = out[i + 1].start - out[i].end;
      if (gap >= 0.45) {
        quietGaps.push({ start: out[i].end, end: out[i + 1].start });
      }
    }
    if (out.length && speechEnd > 0 && durationSec > speechEnd + 0.45) {
      // trailing hush before file end (unless a replay covers it)
      const trailStart = speechEnd;
      const covered = replays.some(
        (r) => r.audio_start < durationSec && r.audio_end > trailStart,
      );
      if (!covered) {
        quietGaps.push({ start: trailStart, end: durationSec });
      }
    }
  }

  return { words: out, replays, speechEnd, quietGaps };
}

/**
 * Fallback only when timings_json missing. Pack into estimated speech span
 * (≈ first 55% of Muallim files are speech; rest is often silence/padding).
 */
export function weightedWordTimings(
  words: string[],
  durationSec: number,
  speechEndSec?: number,
): WordTiming[] {
  if (!words.length || durationSec <= 0) return [];
  const weights = words.map((w) => {
    const n = Math.max(1, Array.from(w.replace(/\s/g, "")).length);
    return Math.max(2.5, n);
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const speechEnd =
    speechEndSec && speechEndSec > 1
      ? Math.min(durationSec, Math.max(speechEndSec, durationSec * 0.35))
      : Math.min(durationSec, Math.max(durationSec * 0.55, 1.2));
  const usable = Math.max(0.08, speechEnd);
  let t = 0;
  return weights.map((w, i) => {
    const dur = usable * (w / total);
    const start = t;
    const end = i === words.length - 1 ? speechEnd : t + dur;
    t = end;
    return { i, start, end: Math.max(start + 0.05, end) };
  });
}

function mapReplayTime(t: number, replays: TimingReplay[]): number {
  for (const r of replays) {
    if (t >= r.audio_start && t < r.audio_end) {
      const span = r.audio_end - r.audio_start || 1;
      const ratio = (t - r.audio_start) / span;
      return r.ref_start + ratio * (r.ref_end - r.ref_start);
    }
  }
  return t;
}

export function activeWordIndex(
  t: number,
  timings: WordTiming[],
  replays: TimingReplay[] = [],
  quietGaps: QuietGap[] = [],
): number {
  if (!timings.length) return -1;
  const inReplay = replays.some((r) => t >= r.audio_start && t < r.audio_end);

  // Absolute hush on the audio timeline (teaching pause / padding) → no highlight,
  // even if replay mapping or bad word spans would otherwise light a word.
  if (!inReplay) {
    for (const g of quietGaps) {
      if (t >= g.start && t < g.end) return -1;
    }
  }

  const tc = mapReplayTime(t, replays);

  // After first-pass speech and outside any replay → no active word (quiet tail)
  const last = timings[timings.length - 1];
  if (!inReplay && t > last.end + 0.12) {
    return -1;
  }

  // Before first speech → no highlight (leading silence)
  if (tc < timings[0].start) return -1;

  for (let i = 0; i < timings.length; i++) {
    const w = timings[i];
    if (tc >= w.start && tc < w.end) return w.i;
    const next = timings[i + 1];
    // Teaching pause between words → clear highlight (do not march through silence)
    if (next && tc >= w.end && tc < next.start) return -1;
  }

  if (tc >= last.start && tc <= last.end + 0.12) return last.i;
  return -1;
}

/** Paint score onto the fixed reference word list (ignores ASR insertions). */
export function paintScoreWords(
  referenceText: string,
  logWords: { ref_index?: number | null; status?: string }[],
  maxVisibleErrors = 2,
): { ref_token: string; status: string; active: boolean }[] {
  const refs = splitWords(referenceText);
  const byRef = new Map<number, string>();
  for (const w of logWords) {
    if (w.ref_index == null || w.ref_index < 0) continue;
    byRef.set(w.ref_index, w.status === "ok" ? "ok" : "bad");
  }
  let shownBad = 0;
  return refs.map((t, i) => {
    let status = byRef.get(i) ?? "pending";
    if (status === "bad") {
      shownBad += 1;
      if (shownBad > maxVisibleErrors) status = "pending";
    }
    return { ref_token: t, status, active: false };
  });
}
