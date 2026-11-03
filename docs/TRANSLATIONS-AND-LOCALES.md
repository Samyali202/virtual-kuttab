# Translations & UI locales (locked)

**Product rule:** Arabic Uthmani mushaf is always available and is the **default** text view. Karaoke (word highlight) exists **only** on the Arabic mushaf. Translation view highlights the **whole ayah** at once — no word karaoke in this phase. Ayah number in translation view is shown **at the end** of the ayah text.

## Locale → what the learner sees

| UI language | Mushaf (default) | Translation tab |
|-------------|------------------|-----------------|
| **Arabic (`ar`)** | Arabic only | **None** — no translation tab |
| **English (`en`)** | Arabic + English | Saheeh International (`en.sahih`) |
| **Russian (`ru`)** | Arabic + Russian | Elmir Kuliev (`ru.kuliev`) |
| **Spanish (`es`)** | Arabic + Spanish | Muhammad Isa García (`es.garcia`) |
| **German (`de`)** | Arabic + German | Bubenheim & Elyas (`de.bubenheim`) |
| **French (`fr`)** | Arabic + French | Muhammad Hamidullah (`fr.hamidullah`) |
| **Urdu (`ur`)** | Arabic + Urdu | Abul Aʿla Maududi (`ur.maududi`) |

When UI is not Arabic, default pane is still **Arabic mushaf**. User must explicitly open **ترجمة / Translation**.

## Tanzil sources (verified downloads)

| ID | Language | Edition | URL |
|----|----------|---------|-----|
| `en.sahih` | English | Saheeh International | https://tanzil.net/trans/en.sahih |
| `ru.kuliev` | Russian | Elmir Kuliev | https://tanzil.net/trans/ru.kuliev |
| `es.garcia` | Spanish | Muhammad Isa García | https://tanzil.net/trans/es.garcia |
| `de.bubenheim` | German | A. S. F. Bubenheim & N. Elyas | https://tanzil.net/trans/de.bubenheim |
| `fr.hamidullah` | French | Muhammad Hamidullah | https://tanzil.net/trans/fr.hamidullah |
| `ur.maududi` | Urdu | Abul Aʿla Maududi | https://tanzil.net/trans/ur.maududi |

Formats available from https://tanzil.net/trans/ : **Text** (with aya numbers), **XML**, **SQL**. We use **Text** (`surah|ayah|text`, UTF-8).

Raw + processed files live under `content/tanzil/translations/` (see `ATTRIBUTION.md`). Web runtime loads slim JSON from `apps/web/public/translations/`.

## Adding a new UI language (checklist)

1. Add locale id to `apps/web/lib/i18n` (`LOCALES` + messages file).
2. Add surah display names from a **verified** source (never invent). Until then, fall back to English transliteration in `surahName()`.
3. Download the approved translation from Tanzil (or document another licensed source).
4. Map `locale → translationId` in `apps/web/lib/translations.ts`.
5. Run `node scripts/prepare_web_translations.mjs` (extend script for the new id).
6. Update **this file** and `content/tanzil/translations/ATTRIBUTION.md`.
7. Translation tab appears only when a mapping exists; Arabic UI never shows a translation tab.

## UX (lesson)

- Segmented control: **مصحف / Mushaf** vs **ترجمة / Translation** (icons + label).
- Mushaf: `dir="rtl"`, word karaoke while listening.
- Translation: LTR for EN/RU/ES/DE/FR, RTL for UR; whole-ayah highlight while that ayah is the active lesson (during listen / focus) — not word karaoke.
