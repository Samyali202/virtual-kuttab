"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  activeWordIndex,
  paintScoreWords,
  parseTimingsJson,
  splitWords,
  weightedWordTimings,
  type Ayah,
  type QuietGap,
  type TimingReplay,
  type WordTiming,
} from "../../lib/content";
import { MicPermissionSheet } from "../../components/MicPermissionSheet";
import { MicStatusButton } from "../../components/MicStatusButton";
import {
  IconBackRtl,
  IconBook,
  IconChevronLeft,
  IconChevronRight,
  IconPause,
  IconPlay,
  IconTranslate,
} from "../../components/NavIcons";
import { useI18n } from "../../components/I18nProvider";
import { OnboardingSheet } from "../../components/OnboardingSheet";
import { toLatinDigits } from "../../lib/digits";
import { applySettingsToDom, loadSettings } from "../../lib/settings";
import { saveProgress } from "../../lib/progress";
import { recordScoreAttempt } from "../../lib/stats";
import { AYAH_COUNTS } from "../../lib/surah-catalog";
import { SURAH_META, surahName } from "../../lib/surah-meta";
import {
  getAyahTranslation,
  hasTranslationTab,
  translationForLocale,
  type TextView,
} from "../../lib/translations";
import { supabase } from "../../lib/supabase";

function asrBase(): string {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return "/asr";
  }
  return process.env.NEXT_PUBLIC_ASR_URL || "/asr";
}

const R2_BASE =
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ||
  "https://pub-b2c769f610ef4ef4874156ec483977bb.r2.dev";

type WordStatus = { ref_token: string; status: string; active?: boolean };
type SensitivityMode = "child" | "beginner" | "professional";
type LessonPhase =
  | "loading_ayah"
  | "empty_audio"
  | "idle"
  | "listening"
  | "ready_recite"
  | "recording"
  | "scoring"
  | "success"
  | "retry"
  | "surah_done"
  | "mic_denied";

const SENSITIVITY_OPTIONS: {
  value: SensitivityMode;
  labelKey: "settings.levelChild" | "settings.levelBeginner" | "settings.levelPro";
  hintKey: "lesson.levelHintChild" | "lesson.levelHintBeginner" | "lesson.levelHintPro";
}[] = [
  { value: "child", labelKey: "settings.levelChild", hintKey: "lesson.levelHintChild" },
  { value: "beginner", labelKey: "settings.levelBeginner", hintKey: "lesson.levelHintBeginner" },
  { value: "professional", labelKey: "settings.levelPro", hintKey: "lesson.levelHintPro" },
];

function fileKey(surah: number, ayah: number) {
  return `${String(surah).padStart(3, "0")}${String(ayah).padStart(3, "0")}.mp3`;
}

function loadMode(): SensitivityMode {
  if (typeof window === "undefined") return "beginner";
  const v = window.localStorage.getItem("vk_sensitivity");
  if (v === "child" || v === "beginner" || v === "professional") return v;
  return "beginner";
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function LessonInner() {
  const { t, locale, dir } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const initialSurah = Math.min(114, Math.max(1, Number(search.get("surah")) || 1));
  const initialAyah = Math.max(1, Number(search.get("ayah")) || 1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timingsRef = useRef<WordTiming[]>([]);
  const replaysRef = useRef<TimingReplay[]>([]);
  const quietGapsRef = useRef<QuietGap[]>([]);
  const timingsJsonRef = useRef<unknown>(null);
  const karaokeOnRef = useRef(false);
  const wordReplayStopRef = useRef<(() => void) | null>(null);
  const preferAyahRef = useRef(initialAyah);
  const ayahStageRef = useRef<HTMLElement | null>(null);

  const applyParsedTimings = useCallback((tokens: string[], durationSec: number) => {
    const real = parseTimingsJson(timingsJsonRef.current, tokens.length, durationSec);
    if (real) {
      timingsRef.current = real.words;
      replaysRef.current = real.replays;
      quietGapsRef.current = real.quietGaps;
      return;
    }
    timingsRef.current = weightedWordTimings(tokens, durationSec);
    replaysRef.current = [];
    quietGapsRef.current = [];
  }, []);

  const surahIds = useMemo(
    () => Object.keys(SURAH_META).map(Number).sort((a, b) => a - b),
    [],
  );

  const [surah, setSurah] = useState(initialSurah);
  const [ayah, setAyah] = useState(initialAyah);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [audioUrl, setAudioUrl] = useState(`${R2_BASE}/${fileKey(initialSurah, initialAyah)}`);
  const [hasAudio, setHasAudio] = useState(true);
  const [phase, setPhase] = useState<LessonPhase>("loading_ayah");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [words, setWords] = useState<WordStatus[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [mode, setMode] = useState<SensitivityMode>("beginner");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMicSheet, setShowMicSheet] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [textView, setTextView] = useState<TextView>("mushaf");
  const [translation, setTranslation] = useState<string | null>(null);
  const [translationLoading, setTranslationLoading] = useState(false);

  const showTranslationTab = hasTranslationTab(locale);
  const translationMeta = translationForLocale(locale);

  useEffect(() => {
    setMode(loadMode());
    applySettingsToDom(loadSettings());
    if (window.localStorage.getItem("vk_onboarded") !== "true") {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  // Re-localize chrome messages when language changes (avoid EN leftovers in AR).
  useEffect(() => {
    switch (phase) {
      case "listening":
        setMessage(t("lesson.promptRepeat"));
        break;
      case "ready_recite":
        setMessage(t("lesson.promptAfterListen"));
        break;
      case "recording":
        setMessage(t("lesson.recording"));
        break;
      case "scoring":
        setMessage(t("lesson.scoring"));
        break;
      case "mic_denied":
        setMessage(t("lesson.micDenied"));
        break;
      case "success":
        setMessage(t("lesson.perfect"));
        break;
      case "surah_done":
        setMessage(t("lesson.surahDone"));
        break;
      case "retry":
        break;
      default:
        setMessage(t("lesson.promptIdle"));
        break;
    }
    // Only when locale changes — not on every phase transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, t]);

  // Arabic UI = mushaf only; switching to ar closes translation pane.
  useEffect(() => {
    if (!showTranslationTab) setTextView("mushaf");
  }, [showTranslationTab]);

  useEffect(() => {
    if (!showTranslationTab || textView !== "translation") {
      setTranslation(null);
      setTranslationLoading(false);
      return;
    }
    let cancelled = false;
    setTranslationLoading(true);
    void getAyahTranslation(locale, surah, ayah).then((text) => {
      if (cancelled) return;
      setTranslation(text);
      setTranslationLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [showTranslationTab, textView, locale, surah, ayah]);

  const current = useMemo(
    () => ayahs.find((a) => a.ayah === ayah) || null,
    [ayahs, ayah],
  );
  const meta = SURAH_META[surah];
  const localizedSurah = surahName(surah, locale);
  const badWords = useMemo(
    () => words.filter((w) => w.status === "bad"),
    [words],
  );
  const resetWords = useCallback((text: string) => {
    setWords(splitWords(text).map((t) => ({ ref_token: t, status: "pending", active: false })));
  }, []);

  const activeWordIdx = useMemo(
    () => words.findIndex((w) => w.active),
    [words],
  );

  // Keep karaoke highlight in view on long ayahs (scroll stage up with the word).
  useEffect(() => {
    if (activeWordIdx < 0 || textView !== "mushaf") return;
    const stage = ayahStageRef.current;
    if (!stage) return;
    const el = stage.querySelector(`[data-word-idx="${activeWordIdx}"]`);
    if (!(el instanceof HTMLElement)) return;
    const stageRect = stage.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta =
      elRect.top + elRect.height / 2 - (stageRect.top + stageRect.height / 2);
    if (Math.abs(delta) < 8) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stage.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
  }, [activeWordIdx, textView]);

  const rebuildTimings = useCallback(() => {
    const el = audioRef.current;
    const tokens = words.map((w) => w.ref_token);
    if (!el || !tokens.length || !el.duration || !Number.isFinite(el.duration)) {
      timingsRef.current = [];
      replaysRef.current = [];
      quietGapsRef.current = [];
      return;
    }
    applyParsedTimings(tokens, el.duration);
  }, [words, applyParsedTimings]);

  const syncUrl = useCallback(
    (s: number, a: number) => {
      router.replace(`/lesson?surah=${s}&ayah=${a}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadErr(null);
    setPhase("loading_ayah");
    (async () => {
      const { data, error } = await supabase
        .from("ayahs")
        .select("surah,ayah,text_uthmani")
        .eq("surah", surah)
        .order("ayah");
      if (cancelled) return;
      if (error) {
        setLoadErr(error.message);
        setAyahs([]);
        setPhase("idle");
        return;
      }
      const list = (data || []) as Ayah[];
      setAyahs(list);
      const want = preferAyahRef.current;
      const pick =
        list.find((a) => a.ayah === want)?.ayah ?? list[0]?.ayah ?? 1;
      preferAyahRef.current = pick;
      setAyah(pick);
      const row = list.find((a) => a.ayah === pick) || list[0];
      if (row) resetWords(row.text_uthmani);
      saveProgress({ surah, ayah: pick });
      syncUrl(surah, pick);
    })();
    return () => {
      cancelled = true;
    };
  }, [surah, resetWords, syncUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fallback = `${R2_BASE}/${fileKey(surah, ayah)}`;
      const { data } = await supabase
        .from("ayah_audio")
        .select("audio_url,timings_json")
        .eq("surah", surah)
        .eq("ayah", ayah)
        .eq("qari", "husary_muallim_128kbps")
        .maybeSingle();
      if (cancelled) return;
      karaokeOnRef.current = false;
      timingsJsonRef.current = data?.timings_json ?? null;
      const url = data?.audio_url || fallback;
      setAudioUrl(url);
      setHasAudio(Boolean(url));
      if (current) resetWords(current.text_uthmani);
      setProgress(0);
      setDuration(0);
      setPhase(url ? "idle" : "empty_audio");
      setMessage(!url ? t("lesson.noAudio") : t("lesson.promptIdle"));
      saveProgress({ surah, ayah });
      audioRef.current?.pause();
      audioRef.current?.load();
    })();
    return () => {
      cancelled = true;
    };
  }, [surah, ayah, current, resetWords, t]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    let raf = 0;
    let lastIdx = -1;

    const onMeta = () => {
      rebuildTimings();
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const tick = () => {
      if (!el.paused && !el.ended) setProgress(el.currentTime);
      if (karaokeOnRef.current && !el.paused && !el.ended) {
        const idx = activeWordIndex(
          el.currentTime,
          timingsRef.current,
          replaysRef.current,
          quietGapsRef.current,
        );
        if (idx !== lastIdx) {
          lastIdx = idx;
          setWords((prev) => prev.map((w, i) => ({ ...w, active: i === idx })));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      karaokeOnRef.current = true;
      lastIdx = -2;
      setPhase("listening");
      setWords((prev) => prev.map((w) => ({ ...w, active: false })));
    };
    const onPause = () => {
      if (karaokeOnRef.current && !el.ended) {
        karaokeOnRef.current = false;
        setPhase("idle");
      }
    };
    const onEnded = () => {
      karaokeOnRef.current = false;
      lastIdx = -1;
      setProgress(el.duration || 0);
      setWords((prev) => prev.map((w) => ({ ...w, active: false })));
      setPhase("ready_recite");
      setMessage(t("lesson.promptAfterListen"));
    };

    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [audioUrl, rebuildTimings]);

  async function playListen(opts?: { restart?: boolean }) {
    const el = audioRef.current;
    if (!el || !current || !hasAudio) return;
    const dur = el.duration;
    const nearEnd =
      Number.isFinite(dur) && dur > 0 && el.currentTime >= Math.max(0, dur - 0.2);
    const canResume =
      !opts?.restart &&
      !el.ended &&
      !nearEnd &&
      el.currentTime > 0.05 &&
      Number.isFinite(dur) &&
      dur > 0;

    if (!canResume) {
      resetWords(current.text_uthmani);
      const tokens = splitWords(current.text_uthmani);
      if (dur && Number.isFinite(dur)) applyParsedTimings(tokens, dur);
      karaokeOnRef.current = true;
      setWords(tokens.map((tok) => ({ ref_token: tok, status: "pending", active: false })));
      el.currentTime = 0;
      setProgress(0);
    } else {
      karaokeOnRef.current = true;
    }

    try {
      await el.play();
      setMessage(t("lesson.promptRepeat"));
    } catch {
      setPhase("idle");
      setMessage(t("lesson.audioFail"));
    }
  }

  function pauseListen() {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    karaokeOnRef.current = false;
    setWords((prev) => prev.map((w) => ({ ...w, active: false })));
    setPhase("idle");
    setMessage(t("lesson.promptStopped"));
  }

  /** @deprecated alias — pause keeps position so Play can resume */
  function stopListen() {
    pauseListen();
  }

  function seekListen(value: number) {
    const el = audioRef.current;
    if (!el || !Number.isFinite(value)) return;
    el.currentTime = value;
    setProgress(value);
  }

  async function beginReciteCapture() {
    if (!current) return;
    karaokeOnRef.current = false;
    audioRef.current?.pause();
    wordReplayStopRef.current?.();
    resetWords(current.text_uthmani);
    setMessage(t("lesson.recording"));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await scoreBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
      };
      mediaRef.current = rec;
      rec.start();
      setPhase("recording");
    } catch {
      setPhase("mic_denied");
      setMessage(t("lesson.micDenied"));
    }
  }

  async function startRecite() {
    if (!current) return;
    if (window.localStorage.getItem("vk_mic_explained") !== "true") {
      setShowMicSheet(true);
      return;
    }
    await beginReciteCapture();
  }

  function stopRecite() {
    mediaRef.current?.stop();
  }

  async function scoreBlob(blob: Blob) {
    if (!current) return;
    setBusy(true);
    setPhase("scoring");
    setMessage(t("lesson.scoring"));
    resetWords(current.text_uthmani);
    try {
      const form = new FormData();
      form.append("audio", blob, "recite.webm");
      form.append("surah", String(current.surah));
      form.append("ayah", String(current.ayah));
      form.append("reference_text", current.text_uthmani);
      form.append("mode", mode);
      const res = await fetch(`${asrBase()}/score`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const log = await res.json();
      const painted = paintScoreWords(
        current.text_uthmani,
        Array.isArray(log.words) ? log.words : [],
      );
      setWords(painted);
      const badCount = painted.filter((w) => w.status === "bad").length;
      const okCount = painted.filter((w) => w.status === "ok").length;
      const perfect = Boolean(log.perfect) || (badCount === 0 && okCount > 0);
      setPhase(perfect ? "success" : badCount > 0 ? "retry" : "idle");
      setMessage(
        perfect
          ? log.message_ar || t("lesson.perfect")
          : badCount > 0
            ? log.message_ar ||
              `${toLatinDigits(badCount)} ${
                badCount === 1
                  ? t("lesson.wordsNeedReviewOne")
                  : t("lesson.wordsNeedReviewMany")
              }`
            : log.message_ar || t("lesson.scoring"),
      );
      saveProgress({
        surah: current.surah,
        ayah: current.ayah,
        perfect,
        badCount,
      });
      const stats = recordScoreAttempt();
      try {
        if (perfect && typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(100);
        } else if (!perfect && typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([50, 30, 50]);
        }
      } catch {
        /* ignore */
      }
      if (
        stats.totalScores >= 3 &&
        window.localStorage.getItem("vk_install_hint") !== "true" &&
        !window.matchMedia("(display-mode: standalone)").matches
      ) {
        setShowInstallHint(true);
      }

      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (uid) {
        await supabase.from("ayah_attempts").insert({
          user_id: uid,
          surah: current.surah,
          ayah: current.ayah,
          wer: log.wer ?? null,
          perfect: !!log.perfect,
          hypothesis: log.hypothesis ?? null,
          error_log: log,
        });
      }
    } catch (e) {
      setPhase("idle");
      setMessage(`${t("lesson.scoreFail")}: ${String(e)}`);
      resetWords(current.text_uthmani);
    } finally {
      setBusy(false);
    }
  }

  function stopLessonAudio() {
    karaokeOnRef.current = false;
    wordReplayStopRef.current?.();
    wordReplayStopRef.current = null;
    audioRef.current?.pause();
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
    }
  }

  function goNextAyah() {
    if (!ayahs.length) return;
    const idx = ayahs.findIndex((a) => a.ayah === ayah);
    const next = ayahs[idx + 1];
    if (next) {
      preferAyahRef.current = next.ayah;
      setAyah(next.ayah);
      syncUrl(surah, next.ayah);
      setMessage(t("lesson.promptIdle"));
      return;
    }
    setPhase("surah_done");
    setMessage(t("lesson.surahDone"));
  }

  /** Arrow control: advance ayah, or roll into next surah (not surah_done banner). */
  function navigateNextAyah() {
    stopLessonAudio();
    if (!ayahs.length) return;
    const idx = ayahs.findIndex((a) => a.ayah === ayah);
    const next = ayahs[idx + 1];
    if (next) {
      preferAyahRef.current = next.ayah;
      setAyah(next.ayah);
      syncUrl(surah, next.ayah);
      setPhase("loading_ayah");
      setMessage(t("lesson.promptIdle"));
      return;
    }
    if (surah >= 114) return;
    const nextSurah = surah + 1;
    preferAyahRef.current = 1;
    setSurah(nextSurah);
    setAyah(1);
    syncUrl(nextSurah, 1);
    setPhase("loading_ayah");
    setMessage(t("lesson.promptIdle"));
  }

  function navigatePrevAyah() {
    stopLessonAudio();
    if (!ayahs.length) return;
    const idx = ayahs.findIndex((a) => a.ayah === ayah);
    if (idx > 0) {
      const prev = ayahs[idx - 1];
      preferAyahRef.current = prev.ayah;
      setAyah(prev.ayah);
      syncUrl(surah, prev.ayah);
      setPhase("loading_ayah");
      setMessage(t("lesson.promptIdle"));
      return;
    }
    if (surah <= 1) return;
    const prevSurah = surah - 1;
    const last = AYAH_COUNTS[prevSurah] || 1;
    preferAyahRef.current = last;
    setSurah(prevSurah);
    setAyah(last);
    syncUrl(prevSurah, last);
    setPhase("loading_ayah");
    setMessage(t("lesson.promptIdle"));
  }

  function goNextSurah() {
    const nextSurah = surah < 114 ? surah + 1 : 1;
    preferAyahRef.current = 1;
    setSurah(nextSurah);
  }

  const canGoPrev = !(surah === 1 && ayah === 1);
  const canGoNext = !(
    surah === 114 &&
    ayah === (AYAH_COUNTS[114] || ayahs[ayahs.length - 1]?.ayah || 6)
  );

  function replayWord(wordIndex: number) {
    const el = audioRef.current;
    if (!el || !hasAudio) return;
    wordReplayStopRef.current?.();
    wordReplayStopRef.current = null;
    if (!timingsRef.current.length && current) {
      const tokens = splitWords(current.text_uthmani);
      const dur = el.duration;
      if (dur && Number.isFinite(dur)) applyParsedTimings(tokens, dur);
    }
    const timed =
      timingsRef.current.find((t) => t.i === wordIndex) ||
      timingsRef.current[wordIndex];
    if (!timed) {
      setMessage(t("lesson.noWordTiming"));
      return;
    }
    karaokeOnRef.current = false;
    audioRef.current?.pause();
    el.currentTime = Math.max(0, timed.start);
    setWords((prev) =>
      prev.map((w, i) => ({
        ...w,
        active: i === wordIndex,
      })),
    );
    const endAt = timed.end + 0.05;
    const onTime = () => {
      if (el.currentTime >= endAt || el.ended) {
        el.pause();
        el.removeEventListener("timeupdate", onTime);
        wordReplayStopRef.current = null;
        setWords((prev) => prev.map((w) => ({ ...w, active: false })));
      }
    };
    wordReplayStopRef.current = () => {
      el.removeEventListener("timeupdate", onTime);
      el.pause();
    };
    el.addEventListener("timeupdate", onTime);
    void el.play().catch(() => {
      el.removeEventListener("timeupdate", onTime);
      setMessage(t("lesson.wordPlayFail"));
    });
  }

  function changeSurah(id: number) {
    preferAyahRef.current = 1;
    setSurah(id);
    // Keep picker open so the learner can pick the ayah next.
  }

  function changeAyah(id: number) {
    preferAyahRef.current = id;
    setAyah(id);
    syncUrl(surah, id);
    setPickerOpen(false);
  }

  const primary = useMemo(() => {
    if (phase === "listening") {
      return {
        label: t("lesson.pause"),
        action: "stop_listen" as const,
        pulse: false,
        stop: false,
        icon: "pause" as const,
      };
    }
    if (phase === "recording") {
      return {
        label: t("lesson.stopRecord"),
        action: "stop_recite" as const,
        pulse: false,
        stop: true,
        icon: null,
      };
    }
    if (phase === "scoring") {
      return {
        label: t("lesson.scoring"),
        action: "none" as const,
        pulse: false,
        stop: false,
        icon: null,
      };
    }
    if (phase === "success") {
      return {
        label: t("lesson.nextAyah"),
        action: "next" as const,
        pulse: false,
        stop: false,
        icon: null,
      };
    }
    if (phase === "surah_done") {
      return {
        label: t("lesson.nextSurah"),
        action: "next_surah" as const,
        pulse: false,
        stop: false,
        icon: null,
      };
    }
    if (phase === "retry") {
      return {
        label: t("lesson.retryRecord"),
        action: "recite" as const,
        pulse: false,
        stop: false,
        icon: null,
      };
    }
    if (phase === "ready_recite") {
      return {
        label: t("lesson.recordNow"),
        action: "recite" as const,
        pulse: true,
        stop: false,
        icon: null,
      };
    }
    if (phase === "mic_denied") {
      return {
        label: t("mic.tryAgain"),
        action: "recite" as const,
        pulse: false,
        stop: false,
        icon: null,
      };
    }
    return {
      label: t("lesson.listen"),
      action: "listen" as const,
      pulse: false,
      stop: false,
      icon: "play" as const,
    };
  }, [phase, t]);

  const showDockMic =
    primary.action === "recite" ||
    primary.action === "stop_recite" ||
    phase === "mic_denied";

  function runPrimary() {
    switch (primary.action) {
      case "listen":
        void playListen();
        break;
      case "stop_listen":
        stopListen();
        break;
      case "recite":
        void startRecite();
        break;
      case "stop_recite":
        stopRecite();
        break;
      case "next":
        goNextAyah();
        break;
      case "next_surah":
        goNextSurah();
        break;
      default:
        break;
    }
  }

  const primaryDisabled =
    busy ||
    phase === "scoring" ||
    phase === "loading_ayah" ||
    phase === "empty_audio" ||
    (primary.action === "listen" && (!current || !hasAudio)) ||
    (primary.action === "recite" && !current);

  return (
    <div className="lesson" data-phase={phase}>
      <OnboardingSheet
        open={showOnboarding}
        onDone={() => {
          window.localStorage.setItem("vk_onboarded", "true");
          setShowOnboarding(false);
        }}
      />
      <MicPermissionSheet
        open={showMicSheet}
        onAllowed={() => {
          setShowMicSheet(false);
          void beginReciteCapture();
        }}
        onDismiss={() => setShowMicSheet(false)}
      />
      {showInstallHint ? (
        <div className="install-toast" role="status">
          <span>{t("lesson.installHint")}</span>
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem("vk_install_hint", "true");
              setShowInstallHint(false);
            }}
          >
            {t("lesson.later")}
          </button>
        </div>
      ) : null}
      <header className="lesson-top" dir={dir} lang={locale}>
        <Link href="/" className="top-home" aria-label={t("common.home")}>
          <IconBackRtl />
        </Link>
        <nav className="ayah-chip-nav" aria-label={t("lesson.labelAyah")} dir="ltr">
          <button
            type="button"
            className="ayah-stepper-btn"
            aria-label={t("lesson.prevAyah")}
            disabled={!canGoPrev || busy || phase === "recording" || phase === "scoring"}
            onClick={navigatePrevAyah}
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            className="breadcrumb"
            dir={dir}
            lang={locale}
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            aria-label={`${localizedSurah} — ${t("common.ayah")} ${toLatinDigits(ayah)}`}
          >
            <span className="breadcrumb-surah">{localizedSurah || "…"}</span>
            <span className="breadcrumb-ayah">
              {t("common.ayah")} {toLatinDigits(ayah)}
            </span>
          </button>
          <button
            type="button"
            className="ayah-stepper-btn"
            aria-label={t("lesson.nextAyah")}
            disabled={!canGoNext || busy || phase === "recording" || phase === "scoring"}
            onClick={navigateNextAyah}
          >
            <IconChevronRight />
          </button>
        </nav>
      </header>

      {pickerOpen ? (
        <div
          className="sheet-backdrop"
          role="presentation"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="sheet ayah-picker-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("lesson.pickAyah")}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="sheet-title">{t("lesson.pickAyah")}</h2>
            <div className="ayah-picker-fields">
              <div className="ayah-picker-field">
                <label htmlFor="lesson-surah-select">{t("lesson.labelSurah")}</label>
                <select
                  id="lesson-surah-select"
                  className="ayah-picker-select"
                  value={surah}
                  onChange={(e) => changeSurah(Number(e.target.value))}
                >
                  {surahIds.map((id) => (
                    <option key={id} value={id}>
                      {toLatinDigits(id)}. {surahName(id, locale)}
                      {locale !== "ar" ? ` — ${SURAH_META[id].ar}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ayah-picker-field">
                <label htmlFor="lesson-ayah-select">{t("lesson.labelAyah")}</label>
                <select
                  id="lesson-ayah-select"
                  className="ayah-picker-select"
                  value={ayah}
                  onChange={(e) => changeAyah(Number(e.target.value))}
                  disabled={!ayahs.length}
                >
                  {ayahs.map((a) => (
                    <option key={a.ayah} value={a.ayah}>
                      {toLatinDigits(a.ayah)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              className="sheet-cta"
              onClick={() => setPickerOpen(false)}
            >
              {t("common.done")}
            </button>
          </div>
        </div>
      ) : null}

      {showTranslationTab ? (
        <div className="text-view-tabs" role="tablist" aria-label={t("lesson.ayahText")}>
          <button
            type="button"
            role="tab"
            className={textView === "mushaf" ? "text-view-tab active" : "text-view-tab"}
            aria-selected={textView === "mushaf"}
            onClick={() => setTextView("mushaf")}
          >
            <IconBook />
            <span>{t("lesson.viewMushaf")}</span>
          </button>
          <button
            type="button"
            role="tab"
            className={textView === "translation" ? "text-view-tab active" : "text-view-tab"}
            aria-selected={textView === "translation"}
            onClick={() => setTextView("translation")}
          >
            <IconTranslate />
            <span>{t("lesson.viewTranslation")}</span>
          </button>
        </div>
      ) : null}

      <section
        ref={ayahStageRef}
        className="ayah-stage"
        aria-label={t("lesson.ayahText")}
        dir={textView === "mushaf" ? "rtl" : translationMeta?.dir ?? "ltr"}
        lang={textView === "mushaf" ? "ar" : locale}
      >
        <div className="ayah-stage-inner">
        {loadErr ? <p className="status err">{loadErr}</p> : null}
        {textView === "translation" && showTranslationTab ? (
          translationLoading ? (
            <p className="translation-ayah" role="status">
              {t("lesson.translationLoading")}
            </p>
          ) : translation ? (
            <p
              className={[
                "translation-ayah",
                phase === "listening" || phase === "ready_recite" ? "ayah-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              dir={translationMeta?.dir ?? "ltr"}
              lang={locale}
            >
              {translation}{" "}
              <span className="translation-ayah-num latin-num">
                ({toLatinDigits(ayah)})
              </span>
            </p>
          ) : (
            <p className="translation-ayah muted">{t("lesson.translationMissing")}</p>
          )
        ) : phase === "loading_ayah" && !words.length ? (
          <div
            className="ayah-skeleton-lines"
            aria-label={t("lesson.loadingAyah")}
            role="status"
          >
            <span />
            <span />
            <span />
          </div>
        ) : (
          <p className="ayah mushaf-ar" lang="ar" dir="rtl">
            {words.map((w, i) => (
              <span
                key={`${i}-${w.ref_token}`}
                data-word-idx={i}
                className={[
                  "word",
                  w.status === "ok" ? "ok" : "",
                  w.status === "bad" ? "bad" : "",
                  w.active ? "active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={w.active ? "true" : undefined}
              >
                {w.ref_token}
              </span>
            ))}
            {words.length && ayah ? (
              <span
                className="ayah-end"
                title={`${t("common.ayah")} ${toLatinDigits(ayah)}`}
                aria-label={`${t("common.ayah")} ${toLatinDigits(ayah)}`}
              >
                <span className="ayah-end-ornament" aria-hidden="true">
                  {"\uFD3E"}
                </span>
                <span className="ayah-end-num">{toLatinDigits(ayah)}</span>
                <span className="ayah-end-ornament" aria-hidden="true">
                  {"\uFD3F"}
                </span>
              </span>
            ) : null}
          </p>
        )}

        {phase === "success" ? (
          <div className="result-banner ok" role="status">
            <p>{t("lesson.perfect")}</p>
          </div>
        ) : null}

        {phase === "surah_done" ? (
          <div className="result-banner ok" role="status">
            <p>{t("lesson.surahDoneTitle", { name: localizedSurah })}</p>
            <Link className="result-link" href="/browse">
              {t("lesson.pickOtherSurah")}
            </Link>
          </div>
        ) : null}

        {phase === "retry" && badWords.length ? (
          <div className="mistake-sheet" role="region" aria-label={t("lesson.wordsNeedReviewMany")}>
            <p className="mistake-title">
              {toLatinDigits(badWords.length)}{" "}
              {badWords.length === 1
                ? t("lesson.wordsNeedReviewOne")
                : t("lesson.wordsNeedReviewMany")}
            </p>
            <ul className="mistake-list">
              {words.map((w, i) =>
                w.status === "bad" ? (
                  <li key={`${i}-${w.ref_token}`}>
                    <span className="mistake-token mushaf-ar" lang="ar" dir="rtl">
                      {w.ref_token}
                    </span>
                    <span className="mistake-actions">
                      <button
                        type="button"
                        className="mistake-play"
                        onClick={() => replayWord(i)}
                        disabled={!hasAudio || busy}
                        title={t("lesson.hearTeacher")}
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        className="mistake-try"
                        onClick={() => void startRecite()}
                        disabled={busy}
                      >
                        {t("lesson.tryWord")}
                      </button>
                    </span>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        ) : null}
        </div>
      </section>

      <audio ref={audioRef} src={audioUrl} preload="metadata" className="sr-only" />

      <footer className="dock">
        <div className="dock-transport">
          <div
            className={
              phase === "listening" ? "listen-bar listening" : "listen-bar quiet"
            }
            data-listening={phase === "listening" ? "true" : "false"}
          >
            {phase === "listening" ? (
              <div className="listen-bar-label">
                <label htmlFor="listen-progress">{t("lesson.listenProgress")}</label>
                <span className="listening-dot on" aria-hidden="true" />
              </div>
            ) : (
              <label className="sr-only" htmlFor="listen-progress">
                {t("lesson.listenProgress")}
              </label>
            )}
            <div className="listen-slider-wrap">
              <div className="listen-fill-track" aria-hidden="true">
                <div
                  className="listen-fill"
                  style={{
                    width:
                      duration > 0
                        ? `${Math.min(100, (progress / duration) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
              <input
                id="listen-progress"
                className="listen-track"
                type="range"
                min={0}
                max={duration || 1}
                step={0.01}
                value={Math.min(progress, duration || 0)}
                disabled={
                  !hasAudio ||
                  !duration ||
                  (phase !== "listening" && phase !== "idle" && phase !== "ready_recite")
                }
                onChange={(e) => seekListen(Number(e.target.value))}
                aria-valuemin={0}
                aria-valuemax={duration || 0}
                aria-valuenow={progress}
                aria-valuetext={t("lesson.progressOf", {
                  current: formatTime(progress),
                  total: formatTime(duration),
                })}
              />
            </div>
            {phase === "listening" || progress > 0 ? (
              <div className="listen-times" aria-hidden="true">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            ) : null}
          </div>

          <div className="dock-level-row">
            <label htmlFor="lesson-level-select">{t("settings.level")}</label>
            <select
              id="lesson-level-select"
              className="dock-level-select"
              value={mode}
              title={
                SENSITIVITY_OPTIONS.find((o) => o.value === mode)
                  ? t(SENSITIVITY_OPTIONS.find((o) => o.value === mode)!.hintKey)
                  : undefined
              }
              onChange={(e) => {
                const next = e.target.value as SensitivityMode;
                setMode(next);
                window.localStorage.setItem("vk_sensitivity", next);
              }}
            >
              {SENSITIVITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {phase === "mic_denied" ? (
          <div className="mic-denied-panel" lang={locale} dir={dir}>
            <MicStatusButton
              onGranted={() => {
                void beginReciteCapture();
              }}
            />
          </div>
        ) : null}

        <div className={showDockMic ? "dock-cta-row with-mic" : "dock-cta-row"}>
          {showDockMic && phase !== "mic_denied" ? (
            <MicStatusButton
              compact
              className="lesson-mic-chip"
              onGranted={() => {
                if (primary.action === "recite") void beginReciteCapture();
              }}
            />
          ) : null}
          <div
            className="actions actions-triptych"
            role="group"
            aria-label={t("lesson.labelAyah")}
            dir="ltr"
          >
            <button
              type="button"
              className="tri-side"
              aria-label={t("lesson.prevAyah")}
              disabled={
                !canGoPrev ||
                busy ||
                phase === "recording" ||
                phase === "scoring"
              }
              onClick={navigatePrevAyah}
            >
              <IconChevronLeft />
            </button>
            <button
              type="button"
              className={[
                "tri-main",
                primary.stop ? "stop" : "",
                primary.pulse ? "cta-pulse" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={runPrimary}
              disabled={primaryDisabled}
              aria-label={primary.label}
            >
              {primary.icon === "play" ? <IconPlay /> : null}
              {primary.icon === "pause" ? <IconPause /> : null}
              <span>{primary.label}</span>
            </button>
            <button
              type="button"
              className="tri-side"
              aria-label={t("lesson.nextAyah")}
              disabled={
                !canGoNext ||
                busy ||
                phase === "recording" ||
                phase === "scoring"
              }
              onClick={navigateNextAyah}
            >
              <IconChevronRight />
            </button>
          </div>
        </div>

        {phase === "ready_recite" || phase === "idle" || phase === "retry" ? (
          <button
            type="button"
            className="dock-link"
            onClick={() => void playListen({ restart: true })}
            disabled={!hasAudio || busy}
          >
            {t("lesson.listenAgain")}
          </button>
        ) : null}

        {phase === "surah_done" ? (
          <Link className="dock-link" href="/browse">
            {t("common.browseSurahs")}
          </Link>
        ) : null}

        {phase !== "success" && phase !== "retry" && phase !== "surah_done" ? (
          <p
            className={
              phase === "mic_denied" ||
              message === t("lesson.audioFail") ||
              message === t("lesson.wordPlayFail") ||
              message.startsWith(t("lesson.scoreFail"))
                ? "status err"
                : "status"
            }
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        ) : null}
      </footer>
    </div>
  );
}

export default function LessonPage() {
  return (
    <Suspense
      fallback={
        <div className="lesson">
          <div className="ayah-skeleton-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      }
    >
      <LessonInner />
    </Suspense>
  );
}
