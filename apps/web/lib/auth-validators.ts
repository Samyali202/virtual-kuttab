/** Stage 0 client validation helpers (no SMS). */

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_RE.test(normalizeUsername(raw));
}

/** Digits-only national number length heuristic by country calling code. */
const NATIONAL_LEN: Record<string, [number, number]> = {
  "966": [9, 9],
  "971": [9, 9],
  "974": [8, 8],
  "973": [8, 8],
  "965": [8, 8],
  "968": [8, 8],
  "20": [10, 10],
  "962": [9, 9],
  "963": [9, 9],
  "961": [7, 8],
  "212": [9, 9],
  "213": [9, 9],
  "216": [8, 8],
  "218": [9, 9],
  "249": [9, 9],
  "7": [10, 10],
  "90": [10, 10],
  "44": [10, 10],
  "1": [10, 10],
  "49": [10, 11],
  "33": [9, 9],
};

export const PHONE_COUNTRIES: { code: string; label: string }[] = [
  { code: "966", label: "🇸🇦 +966" },
  { code: "971", label: "🇦🇪 +971" },
  { code: "974", label: "🇶🇦 +974" },
  { code: "973", label: "🇧🇭 +973" },
  { code: "965", label: "🇰🇼 +965" },
  { code: "968", label: "🇴🇲 +968" },
  { code: "20", label: "🇪🇬 +20" },
  { code: "962", label: "🇯🇴 +962" },
  { code: "963", label: "🇸🇾 +963" },
  { code: "961", label: "🇱🇧 +961" },
  { code: "212", label: "🇲🇦 +212" },
  { code: "213", label: "🇩🇿 +213" },
  { code: "216", label: "🇹🇳 +216" },
  { code: "218", label: "🇱🇾 +218" },
  { code: "249", label: "🇸🇩 +249" },
  { code: "90", label: "🇹🇷 +90" },
  { code: "7", label: "🇷🇺 +7" },
  { code: "44", label: "🇬🇧 +44" },
  { code: "1", label: "🇺🇸 +1" },
  { code: "49", label: "🇩🇪 +49" },
  { code: "33", label: "🇫🇷 +33" },
];

export function toE164(countryCode: string, national: string): string | null {
  const cc = countryCode.replace(/\D/g, "");
  const num = national.replace(/\D/g, "").replace(/^0+/, "");
  if (!cc || !num) return null;
  const range = NATIONAL_LEN[cc] ?? [6, 12];
  if (num.length < range[0] || num.length > range[1]) return null;
  return `+${cc}${num}`;
}

export function isValidEmail(raw: string): boolean {
  const s = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function isValidPassword(raw: string): boolean {
  return raw.length >= 8;
}
