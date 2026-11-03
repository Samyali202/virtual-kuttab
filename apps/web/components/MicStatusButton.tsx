"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  queryMicPermission,
  requestMicAccess,
  type MicPermissionState,
} from "../lib/mic";
import { useI18n } from "./I18nProvider";
import { IconMic, IconMicOff } from "./NavIcons";

type Props = {
  /** Compact icon chip (home/lesson toolbar). */
  compact?: boolean;
  /** Called after a successful grant. */
  onGranted?: () => void;
  className?: string;
};

export function MicStatusButton({ compact = false, onGranted, className }: Props) {
  const { t, locale } = useI18n();
  const [state, setState] = useState<MicPermissionState>("unknown");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    const next = await queryMicPermission();
    setState(next);
  }, []);

  useEffect(() => {
    void refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Keep hint copy in the active UI language if locale flips mid-flow.
  useEffect(() => {
    if (!hint) return;
    if (state === "denied") setHint(t("mic.statusDeniedHint"));
    else if (state === "granted") setHint(t("mic.statusGranted"));
  }, [locale, t]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAllow() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setHint(null);
    setToast(t("mic.requesting"));

    let result: Awaited<ReturnType<typeof requestMicAccess>>;
    try {
      result = await requestMicAccess();
    } catch {
      result = { ok: false, state: "unknown", error: "error" };
    }

    busyRef.current = false;
    setBusy(false);
    setState(result.state);

    if (result.ok) {
      window.localStorage.setItem("vk_mic_explained", "true");
      setHint(t("mic.statusGranted"));
      // Brief confirm only for compact chips (full panel already shows hint).
      if (compact) setToast(t("mic.statusGranted"));
      else setToast(null);
      onGranted?.();
      return;
    }

    if (result.error === "insecure") {
      setHint(t("mic.statusInsecure"));
      if (compact) setToast(t("mic.statusInsecure"));
      else setToast(null);
      return;
    }
    if (result.error === "NotFoundError" || result.error === "DevicesNotFoundError") {
      setHint(t("mic.statusNoDevice"));
      if (compact) setToast(t("mic.statusNoDevice"));
      else setToast(null);
      return;
    }
    if (result.state === "denied") {
      setHint(t("mic.statusDeniedHint"));
      // Compact: short toast at top (never over dock CTA). Full panel shows steps.
      if (compact) setToast(t("mic.statusDeniedShort"));
      else setToast(null);
      return;
    }
    setHint(t("mic.statusError"));
    if (compact) setToast(t("mic.statusError"));
    else setToast(null);
  }

  const granted = state === "granted";
  const denied = state === "denied";
  const label = granted
    ? t("mic.statusGranted")
    : busy
      ? t("mic.requesting")
      : denied
        ? t("mic.tapToAllow")
        : t("mic.tapToAllow");

  if (compact && granted) {
    return null;
  }

  const chipClass = granted
    ? "nav-chip mic-chip ok"
    : denied
      ? "nav-chip mic-chip warn"
      : "nav-chip mic-chip";

  return (
    <div className={className ? `mic-status ${className}` : "mic-status"}>
      <button
        type="button"
        className={chipClass}
        onClick={() => void handleAllow()}
        disabled={busy}
        aria-label={label}
        title={label}
        aria-busy={busy}
      >
        {granted ? <IconMic /> : <IconMicOff />}
        {!compact ? <span>{busy ? t("mic.requesting") : label}</span> : null}
      </button>
      {hint && !compact ? (
        <>
          <p className="mic-status-hint">{hint}</p>
          {denied ? (
            <ol className="mic-reset-steps">
              <li>{t("mic.resetStep1")}</li>
              <li>{t("mic.resetStep2")}</li>
              <li>{t("mic.resetStep3")}</li>
            </ol>
          ) : null}
        </>
      ) : null}
      {toast ? (
        <div className="mic-toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
