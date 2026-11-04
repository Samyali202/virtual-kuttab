"use client";

import { useEffect } from "react";

/** Registers the service worker so the app can be installed as a PWA. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (window.location.protocol !== "https:" && !isLocal) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore — install button still explains manual add */
    });
  }, []);
  return null;
}
