/** Local Hifz progress — ayah-by-ayah continue card (no auth required). */

export type HifzProgress = {
  surah: number;
  ayah: number;
  perfect: boolean | null;
  badCount: number;
  updatedAt: string;
};

const KEY = "vk_hifz_progress";

export function loadProgress(): HifzProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as HifzProgress;
    if (!p?.surah || !p?.ayah) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveProgress( partial: {
  surah: number;
  ayah: number;
  perfect?: boolean | null;
  badCount?: number;
}): void {
  if (typeof window === "undefined") return;
  const prev = loadProgress();
  const next: HifzProgress = {
    surah: partial.surah,
    ayah: partial.ayah,
    perfect: partial.perfect ?? prev?.perfect ?? null,
    badCount: partial.badCount ?? prev?.badCount ?? 0,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function lessonHref(surah: number, ayah: number): string {
  return `/lesson?surah=${surah}&ayah=${ayah}`;
}
