"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SURAH_META,
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
import { IconBackRtl, IconList } from "../../components/NavIcons";
import { OnboardingSheet } from "../../components/OnboardingSheet";
import { applySettingsToDom, loadSettings } from "../../lib/settings";
import { saveProgress } from "../../lib/progress";
import { recordScoreAttempt } from "../../lib/stats";
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

const SENSITIVITY_OPTIONS: { value: SensitivityMode; ar: string; hint: string }[] = [
  { value: "child", ar: "مبتدئ", hint: "تسامح أعلى في النطق" },
  { value: "beginner", ar: "متوسط", hint: "دقة متوسطة" },
  { value: "professional", ar: "مُتقِن", hint: "دقة عالية" },
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
  const [message, setMessage] = useState("استمع للمعلّم، ثم سجّل من حفظك.");
  const [words, setWords] = useState<WordStatus[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [mode, setMode] = useState<SensitivityMode>("beginner");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMicSheet, setShowMicSheet] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);

  useEffect(() => {
    setMode(loadMode());
    applySettingsToDom(loadSettings());
    if (window.localStorage.getItem("vk_onboarded") !== "true") {
      setShowOnboarding(true);
    }
  }, []);

  const current = useMemo(
    () => ayahs.find((a) => a.ayah === ayah) || null,
    [ayahs, ayah],
  );
  const meta = SURAH_META[surah];
  const badWords = useMemo(
    () => words.filter((w) => w.status === "bad"),
    [words],
  );
  const modeLabel =
    SENSITIVITY_OPTIONS.find((o) => o.value === mode)?.ar ?? "متوسط";

  const resetWords = useCallback((text: string) => {
    setWords(splitWords(text).map((t) => ({ ref_token: t, status: "pending", active: false })));
  }, []);

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
      setMessage(
        !url
          ? "لا يتوفر صوت المعلّم لهذه الآية — اختر آية أخرى."
          : "استمع للمعلّم، ثم سجّل من حفظك.",
      );
      saveProgress({ surah, ayah });
      audioRef.current?.pause();
      audioRef.current?.load();
    })();
    return () => {
      cancelled = true;
    };
  }, [surah, ayah, current, resetWords]);

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
      setMessage("أحسنت الاستماع — سجّل الآن من حفظك");
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

  async function playListen() {
    if (!audioRef.current || !current || !hasAudio) return;
    resetWords(current.text_uthmani);
    const tokens = splitWords(current.text_uthmani);
    const dur = audioRef.current.duration;
    if (dur && Number.isFinite(dur)) applyParsedTimings(tokens, dur);
    karaokeOnRef.current = true;
    setWords(tokens.map((t) => ({ ref_token: t, status: "pending", active: false })));
    audioRef.current.currentTime = 0;
    setProgress(0);
    try {
      await audioRef.current.play();
      setMessage("استمع وكرّر بعد الشيخ.");
    } catch {
      setPhase("idle");
      setMessage("تعذّر تشغيل الصوت.");
    }
  }

  function stopListen() {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    karaokeOnRef.current = false;
    setWords((prev) => prev.map((w) => ({ ...w, active: false })));
    setPhase("idle");
    setMessage("توقّف الاستماع — سجّل أو استمع مجدداً.");
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
    setMessage("جاري التسجيل… ثم اضغط إيقاف.");
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
      setMessage("يلزم السماح بالميكروفون من إعدادات المتصفح لإكمال التسجيل.");
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
    setMessage("جاري المقارنة…");
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
          ? log.message_ar || "أحسنت، بارك الله فيك"
          : badCount > 0
            ? log.message_ar || "أعد الكلمات المظلّلة، ثم سجّل مجدداً."
            : log.message_ar || "تم التقييم.",
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
      setMessage(`تعذّر التقييم: ${String(e)}`);
      resetWords(current.text_uthmani);
    } finally {
      setBusy(false);
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
      setMessage("استمع للمعلّم، ثم سجّل من حفظك.");
      return;
    }
    setPhase("surah_done");
    setMessage("أكملت السورة — بارك الله فيك");
  }

  function goNextSurah() {
    const nextSurah = surah < 114 ? surah + 1 : 1;
    preferAyahRef.current = 1;
    setSurah(nextSurah);
  }

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
      setMessage("لا يتوفر توقيت لهذه الكلمة — استمع للآية كاملة.");
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
      setMessage("تعذّر تشغيل مقطع الكلمة.");
    });
  }

  function changeSurah(id: number) {
    preferAyahRef.current = 1;
    setSurah(id);
    setPickerOpen(false);
  }

  function changeAyah(id: number) {
    preferAyahRef.current = id;
    setAyah(id);
    syncUrl(surah, id);
    setPickerOpen(false);
  }

  const primary = useMemo(() => {
    if (phase === "listening") {
      return { label: "إيقاف الاستماع", action: "stop_listen" as const, pulse: false, stop: false };
    }
    if (phase === "recording") {
      return { label: "إيقاف", action: "stop_recite" as const, pulse: false, stop: true };
    }
    if (phase === "scoring") {
      return { label: "جاري المقارنة…", action: "none" as const, pulse: false, stop: false };
    }
    if (phase === "success") {
      return { label: "التالية ←", action: "next" as const, pulse: false, stop: false };
    }
    if (phase === "surah_done") {
      return { label: "السورة التالية", action: "next_surah" as const, pulse: false, stop: false };
    }
    if (phase === "retry") {
      return { label: "أعد التسجيل", action: "recite" as const, pulse: false, stop: false };
    }
    if (phase === "ready_recite") {
      return { label: "سجّل الآن", action: "recite" as const, pulse: true, stop: false };
    }
    if (phase === "mic_denied") {
      return { label: "حاول التسجيل", action: "recite" as const, pulse: false, stop: false };
    }
    return { label: "استمع", action: "listen" as const, pulse: false, stop: false };
  }, [phase]);

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
        onAllow={() => {
          window.localStorage.setItem("vk_mic_explained", "true");
          setShowMicSheet(false);
          void beginReciteCapture();
        }}
        onDismiss={() => setShowMicSheet(false)}
      />
      {showInstallHint ? (
        <div className="install-toast" role="status">
          <span>أضف الكتّاب للشاشة الرئيسية</span>
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem("vk_install_hint", "true");
              setShowInstallHint(false);
            }}
          >
            لاحقاً
          </button>
        </div>
      ) : null}
      <header className="lesson-top">
        <Link href="/" className="top-home" aria-label="الرئيسية">
          <IconBackRtl />
        </Link>
        <Link href="/browse" className="nav-chip" title="تصفّح السور" aria-label="السور">
          <IconList />
          <span>السور</span>
        </Link>
        <button
          type="button"
          className="breadcrumb"
          onClick={() => {
            setPickerOpen((v) => !v);
            setLevelOpen(false);
          }}
          aria-expanded={pickerOpen}
        >
          {meta ? `${meta.ar} · آية ${ayah}` : "…"}
        </button>
        <button
          type="button"
          className="level-trigger"
          title="مستوى الدقة"
          aria-label="مستوى الدقة"
          aria-expanded={levelOpen}
          onClick={() => {
            setLevelOpen((v) => !v);
            setPickerOpen(false);
          }}
        >
          {modeLabel}
        </button>
      </header>

      {pickerOpen ? (
        <div className="picker-sheet" role="dialog" aria-label="اختيار الآية">
          <div className="chip">
            <label htmlFor="surah">السورة</label>
            <select
              id="surah"
              value={surah}
              onChange={(e) => changeSurah(Number(e.target.value))}
            >
              {surahIds.map((id) => (
                <option key={id} value={id}>
                  {id}. {SURAH_META[id].ar}
                </option>
              ))}
            </select>
          </div>
          <div className="chip">
            <label htmlFor="ayah">الآية</label>
            <select
              id="ayah"
              value={ayah}
              onChange={(e) => changeAyah(Number(e.target.value))}
              disabled={!ayahs.length}
            >
              {ayahs.map((a) => (
                <option key={a.ayah} value={a.ayah}>
                  {a.ayah}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {levelOpen ? (
        <div className="level-sheet" role="group" aria-label="مستوى الدقة">
          {SENSITIVITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={mode === opt.value ? "mode-pill active" : "mode-pill"}
              title={opt.hint}
              aria-pressed={mode === opt.value}
              onClick={() => {
                setMode(opt.value);
                window.localStorage.setItem("vk_sensitivity", opt.value);
                setLevelOpen(false);
              }}
            >
              {opt.ar}
            </button>
          ))}
        </div>
      ) : null}

      <section className="ayah-stage" aria-label="نص الآية">
        {loadErr ? <p className="status err">{loadErr}</p> : null}
        {phase === "loading_ayah" && !words.length ? (
          <div
            className="ayah-skeleton-lines"
            aria-label="جارٍ تحميل الآية…"
            role="status"
          >
            <span />
            <span />
            <span />
          </div>
        ) : (
          <p className="ayah" lang="ar">
            {words.map((w, i) => (
              <span
                key={`${i}-${w.ref_token}`}
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
              <span className="ayah-end" title={`آية ${ayah}`} aria-label={`آية ${ayah}`}>
                <span className="ayah-end-ornament" aria-hidden="true">
                  {"\uFD3E"}
                </span>
                <span className="ayah-end-num">{ayah}</span>
                <span className="ayah-end-ornament" aria-hidden="true">
                  {"\uFD3F"}
                </span>
              </span>
            ) : null}
          </p>
        )}

        {phase === "success" ? (
          <div className="result-banner ok" role="status">
            <p>أحسنت، بارك الله فيك</p>
          </div>
        ) : null}

        {phase === "surah_done" ? (
          <div className="result-banner ok" role="status">
            <p>أكملت سورة {meta?.ar ?? ""}</p>
            <Link className="result-link" href="/browse">
              اختر سورة أخرى
            </Link>
          </div>
        ) : null}

        {phase === "retry" && badWords.length ? (
          <div className="mistake-sheet" role="region" aria-label="كلمات للمراجعة">
            <p className="mistake-title">
              {badWords.length}{" "}
              {badWords.length === 1 ? "كلمة تحتاج مراجعة" : "كلمات تحتاج مراجعة"}
            </p>
            <ul className="mistake-list">
              {words.map((w, i) =>
                w.status === "bad" ? (
                  <li key={`${i}-${w.ref_token}`}>
                    <span className="mistake-token" lang="ar">
                      {w.ref_token}
                    </span>
                    <span className="mistake-actions">
                      <button
                        type="button"
                        className="mistake-play"
                        onClick={() => replayWord(i)}
                        disabled={!hasAudio || busy}
                        title="استمع للمعلّم"
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        className="mistake-try"
                        onClick={() => void startRecite()}
                        disabled={busy}
                      >
                        حاول
                      </button>
                    </span>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        ) : null}
      </section>

      <audio ref={audioRef} src={audioUrl} preload="metadata" className="sr-only" />

      <footer className="dock">
        <div className="listen-bar" data-listening={phase === "listening" ? "true" : "false"}>
          <div className="listen-bar-label">
            <span>تقدّم استماع المعلّم</span>
            <span
              className={phase === "listening" ? "listening-dot on" : "listening-dot"}
              aria-hidden="true"
            />
          </div>
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
            <label className="sr-only" htmlFor="listen-progress">
              تقدّم الاستماع
            </label>
            <input
              id="listen-progress"
              className="listen-track"
              type="range"
              min={0}
              max={duration || 1}
              step={0.01}
              value={Math.min(progress, duration || 0)}
              disabled={!hasAudio || !duration}
              onChange={(e) => seekListen(Number(e.target.value))}
              aria-valuemin={0}
              aria-valuemax={duration || 0}
              aria-valuenow={progress}
              aria-valuetext={`${formatTime(progress)} من ${formatTime(duration)}`}
            />
          </div>
          <div className="listen-times" aria-hidden="true">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="actions actions-single">
          <button
            type="button"
            className={[
              primary.stop ? "stop" : "",
              primary.pulse ? "cta-pulse" : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined}
            onClick={runPrimary}
            disabled={primaryDisabled}
          >
            {primary.label}
          </button>
        </div>

        {phase === "ready_recite" || phase === "idle" || phase === "retry" ? (
          <button type="button" className="dock-link" onClick={() => void playListen()} disabled={!hasAudio || busy}>
            استمع مجدداً
          </button>
        ) : null}

        {phase === "surah_done" ? (
          <Link className="dock-link" href="/browse">
            تصفّح السور
          </Link>
        ) : null}

        {phase !== "success" && phase !== "retry" && phase !== "surah_done" ? (
          <p
            className={
              message.startsWith("تعذّر") || phase === "mic_denied"
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
