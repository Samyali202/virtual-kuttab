import { ar, type MessageTree } from "./messages/ar";
import { de } from "./messages/de";
import { en } from "./messages/en";
import { es } from "./messages/es";
import { fr } from "./messages/fr";
import { ru } from "./messages/ru";
import { ur } from "./messages/ur";

export type LocaleId = "ar" | "en" | "ru" | "es" | "de" | "fr" | "ur";

export type LocaleOption = {
  id: LocaleId;
  dir: "rtl" | "ltr";
  /** Flag emoji shown next to the native language sample. */
  flag: string;
  /** Native script sample — always the language’s own name. */
  sample: string;
  labelKey:
    | "settings.langAr"
    | "settings.langEn"
    | "settings.langRu"
    | "settings.langEs"
    | "settings.langDe"
    | "settings.langFr"
    | "settings.langUr";
};

/** Add new languages here later. */
export const LOCALES: LocaleOption[] = [
  { id: "ar", dir: "rtl", flag: "🇸🇦", sample: "العربية", labelKey: "settings.langAr" },
  { id: "en", dir: "ltr", flag: "🇬🇧", sample: "English", labelKey: "settings.langEn" },
  { id: "ru", dir: "ltr", flag: "🇷🇺", sample: "Русский", labelKey: "settings.langRu" },
  { id: "es", dir: "ltr", flag: "🇪🇸", sample: "Español", labelKey: "settings.langEs" },
  { id: "de", dir: "ltr", flag: "🇩🇪", sample: "Deutsch", labelKey: "settings.langDe" },
  { id: "fr", dir: "ltr", flag: "🇫🇷", sample: "Français", labelKey: "settings.langFr" },
  { id: "ur", dir: "rtl", flag: "🇵🇰", sample: "اردو", labelKey: "settings.langUr" },
];

type Catalog = MessageTree;

const CATALOG: Record<LocaleId, Catalog> = {
  ar,
  en,
  ru,
  es,
  de,
  fr,
  ur,
};

export function isLocaleId(v: unknown): v is LocaleId {
  return (
    v === "ar" ||
    v === "en" ||
    v === "ru" ||
    v === "es" ||
    v === "de" ||
    v === "fr" ||
    v === "ur"
  );
}

export function messagesFor(locale: LocaleId): Catalog {
  return CATALOG[locale] ?? ar;
}

export function dirFor(locale: LocaleId): "rtl" | "ltr" {
  return locale === "ar" || locale === "ur" ? "rtl" : "ltr";
}

type Leaves<T, P extends string = ""> = T extends string
  ? P
  : {
      [K in keyof T & string]: Leaves<T[K], P extends "" ? K : `${P}.${K}`>;
    }[keyof T & string];

export type DotPath = Leaves<typeof ar>;

function lookup(tree: Catalog | MessageTree, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = tree;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

/** Resolve a message; supports `{n}` style placeholders. */
export function t(
  locale: LocaleId,
  path: DotPath | string,
  vars?: Record<string, string | number>,
): string {
  let s = lookup(messagesFor(locale), path) ?? lookup(ar, path) ?? path;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export { ar, de, en, es, fr, ru, ur };
export type { MessageTree };
