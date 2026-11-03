const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/**
 * Product rule: UI numbers are always Western/Latin digits (0–9).
 * Never Arabic-Indic / Hindi digits.
 */
export function toLatinDigits(value: number | string): string {
  const raw =
    typeof value === "number"
      ? String(Math.max(0, Math.floor(value)))
      : String(value);
  return raw.replace(/[٠-٩۰-۹]/g, (ch) => {
    const ai = ARABIC_INDIC.indexOf(ch);
    if (ai >= 0) return String(ai);
    const pi = PERSIAN_INDIC.indexOf(ch);
    return pi >= 0 ? String(pi) : ch;
  });
}
