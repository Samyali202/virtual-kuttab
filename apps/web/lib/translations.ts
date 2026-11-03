import type { LocaleId } from "./i18n";

/** Tanzil translation catalog id served from /translations/{id}.json */
export type TranslationId =
  | "en.sahih"
  | "ru.kuliev"
  | "es.garcia"
  | "de.bubenheim"
  | "fr.hamidullah"
  | "ur.maududi";

export type TextView = "mushaf" | "translation";

/**
 * UI locale → optional ayah translation.
 * Arabic UI: mushaf only (no translation tab).
 * Add new languages here + docs/TRANSLATIONS-AND-LOCALES.md.
 */
export const LOCALE_TRANSLATION: Partial<
  Record<LocaleId, { id: TranslationId; dir: "ltr" | "rtl" }>
> = {
  en: { id: "en.sahih", dir: "ltr" },
  ru: { id: "ru.kuliev", dir: "ltr" },
  es: { id: "es.garcia", dir: "ltr" },
  de: { id: "de.bubenheim", dir: "ltr" },
  fr: { id: "fr.hamidullah", dir: "ltr" },
  ur: { id: "ur.maududi", dir: "rtl" },
};

export function translationForLocale(locale: LocaleId): {
  id: TranslationId;
  dir: "ltr" | "rtl";
} | null {
  return LOCALE_TRANSLATION[locale] ?? null;
}

export function hasTranslationTab(locale: LocaleId): boolean {
  return translationForLocale(locale) != null;
}

type Catalog = Record<string, string>;
const cache = new Map<TranslationId, Catalog>();
const inflight = new Map<TranslationId, Promise<Catalog>>();

async function loadCatalog(id: TranslationId): Promise<Catalog> {
  const hit = cache.get(id);
  if (hit) return hit;
  const pending = inflight.get(id);
  if (pending) return pending;
  const p = fetch(`/translations/${id}.json`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`translation ${id}: ${res.status}`);
      const data = (await res.json()) as Catalog;
      cache.set(id, data);
      inflight.delete(id);
      return data;
    })
    .catch((err) => {
      inflight.delete(id);
      throw err;
    });
  inflight.set(id, p);
  return p;
}

export async function getAyahTranslation(
  locale: LocaleId,
  surah: number,
  ayah: number,
): Promise<string | null> {
  const conf = translationForLocale(locale);
  if (!conf) return null;
  try {
    const cat = await loadCatalog(conf.id);
    return cat[`${surah}:${ayah}`] ?? null;
  } catch {
    return null;
  }
}
