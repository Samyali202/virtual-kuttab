"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { IconInstall } from "./NavIcons";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Top install bar for the Progressive Web App.
 * It sits in normal flow (not over the ayah or the Listen button) and
 * publishes its height so the lesson viewport shrinks to fit beneath it.
 */
export function PwaInstallButton() {
  const { t } = useI18n();
  const pathname = usePathname() || "";
  const barRef = useRef<HTMLDivElement>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const hideOps = pathname.startsWith("/vk-ops-console");
  // Never cover the lesson Listen/triptych dock on mobile.
  const hideLesson = pathname.startsWith("/lesson");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem("vk_pwa_bar_dismissed") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const visible = !installed && !hideOps && !hideLesson && !dismissed;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) {
      setInstalled(true);
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    const el = barRef.current;
    if (!el) {
      document.documentElement.style.removeProperty("--pwa-bar-h");
      return;
    }
    const apply = () => {
      document.documentElement.style.setProperty(
        "--pwa-bar-h",
        `${el.offsetHeight}px`,
      );
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--pwa-bar-h");
    };
  }, [visible]);

  if (!visible) return null;

  const tooltip = deferred ? t("pwa.tooltip") : t("pwa.tooltipManual");

  async function onInstall() {
    if (busy) return;
    if (deferred) {
      setBusy(true);
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
          setDeferred(null);
        }
      } catch {
        setHintOpen(true);
      } finally {
        setBusy(false);
      }
      return;
    }
    setHintOpen((v) => !v);
  }

  return (
    <div
      ref={barRef}
      className="pwa-install-bar"
      data-open={hintOpen ? "true" : "false"}
    >
      <button
        type="button"
        className="pwa-install-btn"
        aria-label={t("pwa.install")}
        title={tooltip}
        aria-describedby={hintOpen ? "pwa-install-tip" : undefined}
        aria-expanded={hintOpen}
        disabled={busy}
        onClick={() => void onInstall()}
        onBlur={() => {
          window.setTimeout(() => {
            if (!document.activeElement?.closest(".pwa-install-bar")) {
              setHintOpen(false);
            }
          }, 0);
        }}
      >
        <IconInstall />
        <span>{t("pwa.installShort")}</span>
      </button>
      {hintOpen ? (
        <div id="pwa-install-tip" className="pwa-install-tip" role="tooltip">
          <p>{tooltip}</p>
          <div className="pwa-install-tip-actions">
            <button
              type="button"
              className="pwa-install-tip-close"
              onClick={() => setHintOpen(false)}
            >
              {t("common.close")}
            </button>
            <button
              type="button"
              className="pwa-install-tip-close"
              onClick={() => {
                try {
                  window.localStorage.setItem("vk_pwa_bar_dismissed", "1");
                } catch {
                  /* ignore */
                }
                setDismissed(true);
                setHintOpen(false);
              }}
            >
              {t("lesson.later")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
