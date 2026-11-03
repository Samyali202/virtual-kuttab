/** Browser microphone permission helpers (permission probe only — stops tracks). */

export type MicPermissionState = "granted" | "denied" | "prompt" | "unknown";

export async function queryMicPermission(): Promise<MicPermissionState> {
  if (typeof navigator === "undefined") return "unknown";
  try {
    const perms = navigator.permissions;
    if (perms?.query) {
      const status = await perms.query({
        name: "microphone" as PermissionName,
      });
      if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
        return status.state;
      }
    }
  } catch {
    /* Safari / older browsers often reject microphone PermissionName */
  }
  return "unknown";
}

function isSecure(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.isSecureContext === true ||
    location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  );
}

/**
 * Must run from a user gesture (tap). Opens the real browser mic prompt.
 * Stops tracks immediately — this is permission-only, not a recording session.
 */
export async function requestMicAccess(): Promise<{
  ok: boolean;
  state: MicPermissionState;
  error?: string;
}> {
  if (typeof navigator === "undefined") {
    return { ok: false, state: "denied", error: "unsupported" };
  }
  if (!isSecure()) {
    return { ok: false, state: "denied", error: "insecure" };
  }
  // Legacy bridge (older WebViews)
  const media =
    navigator.mediaDevices ||
    (navigator as unknown as { webkitGetUserMedia?: unknown });
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, state: "denied", error: "unsupported" };
  }
  void media;

  try {
    // Keep constraints minimal — advanced audio constraints break some mobile browsers.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Release hardware immediately; we only needed the permission grant.
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    }
    return { ok: true, state: "granted" };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : String(err);
    const denied =
      name === "NotAllowedError" ||
      name === "PermissionDeniedError" ||
      name === "SecurityError";
    const notFound = name === "NotFoundError" || name === "DevicesNotFoundError";
    return {
      ok: false,
      state: denied ? "denied" : notFound ? "unknown" : "unknown",
      error: name || "error",
    };
  }
}
