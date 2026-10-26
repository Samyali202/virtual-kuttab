"use client";

import { useMemo, useRef, useState } from "react";

const ASR_URL = process.env.NEXT_PUBLIC_ASR_URL || "http://127.0.0.1:8088";

/** Demo: Al-Fatihah 1:2 — replace with SSoT later */
const DEMO = {
  surah: 1,
  ayah: 2,
  text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
  // Husary Muallim sample only
  audio: "/demo/muallim/001002.mp3",
};

type WordStatus = { ref_token: string; status: string };

export default function HomePage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState("استمع للحصري، ثم سجّل تلاوتك.");
  const [words, setWords] = useState<WordStatus[]>(
    DEMO.text.split(/\s+/).map((t) => ({ ref_token: t, status: "pending" })),
  );
  const [busy, setBusy] = useState(false);

  const colored = useMemo(() => words, [words]);

  async function playListen() {
    if (!audioRef.current) return;
    await audioRef.current.play();
    setMessage("وضع الاستماع — كرّر بعد الشيخ.");
  }

  async function startRecite() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await scoreBlob(blob);
    };
    mediaRef.current = rec;
    rec.start();
    setRecording(true);
    setMessage("جاري التسجيل… اقرأ الآية ثم اضغط إيقاف.");
  }

  function stopRecite() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  async function scoreBlob(blob: Blob) {
    setBusy(true);
    setMessage("جاري المقارنة…");
    try {
      const form = new FormData();
      form.append("audio", blob, "recite.webm");
      form.append("surah", String(DEMO.surah));
      form.append("ayah", String(DEMO.ayah));
      form.append("reference_text", DEMO.text);
      const res = await fetch(`${ASR_URL}/score`, { method: "POST", body: form });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
      const log = await res.json();
      setMessage(log.message_ar || "");
      if (Array.isArray(log.words)) {
        setWords(
          log.words
            .filter((w: WordStatus & { ref_token?: string }) => w.ref_token)
            .map((w: WordStatus) => ({
              ref_token: w.ref_token,
              status: w.status === "ok" ? "ok" : "bad",
            })),
        );
      }
    } catch (e) {
      setMessage(
        `تعذّر الاتصال بخدمة التقييم (${ASR_URL}). تأكد أن FastAPI يعمل. ${String(e)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>الكتّاب الافتراضي</h1>
      <p className="lede">
        استمع للحصري ← كرّر ← سجّل. التقييم على مستوى الكلمات فقط (مثل ترتيل) — بدون تجويد آلي.
      </p>

      <section className="card">
        <div className="ayah" lang="ar">
          {colored.map((w, i) => (
            <span
              key={`${w.ref_token}-${i}`}
              className={
                w.status === "ok" ? "word ok" : w.status === "bad" ? "word bad" : "word"
              }
            >
              {w.ref_token}
            </span>
          ))}
        </div>
        <audio ref={audioRef} src={DEMO.audio} preload="metadata" />
        <div className="actions">
          <button type="button" onClick={playListen}>
            استمع
          </button>
          {!recording ? (
            <button type="button" className="secondary" onClick={startRecite} disabled={busy}>
              سجّل التلاوة
            </button>
          ) : (
            <button type="button" onClick={stopRecite}>
              إيقاف ومقارنة
            </button>
          )}
        </div>
        <p className="status">{message}</p>
      </section>
    </main>
  );
}
