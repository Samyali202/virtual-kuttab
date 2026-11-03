# Quran translations (Tanzil)

Sources downloaded verbatim from Tanzil Project. Do not invent or rewrite ayah translations.

| Locale | ID | Translator / edition | Source URL |
|--------|----|----------------------|------------|
| English | `en.sahih` | Saheeh International | https://tanzil.net/trans/en.sahih |
| Russian | `ru.kuliev` | Elmir Kuliev | https://tanzil.net/trans/ru.kuliev |
| Spanish | `es.garcia` | Muhammad Isa García | https://tanzil.net/trans/es.garcia |
| German | `de.bubenheim` | A. S. F. Bubenheim & N. Elyas | https://tanzil.net/trans/de.bubenheim |
| French | `fr.hamidullah` | Muhammad Hamidullah | https://tanzil.net/trans/fr.hamidullah |
| Urdu | `ur.maududi` | Abul Aʿla Maududi | https://tanzil.net/trans/ur.maududi |

Files: `{id}.txt` (Tanzil line format `surah|ayah|text`) and slim `{id}.json` for tooling / web build.

## Surah display names (Russian)

Russian surah **names** (UI labels) come from the verified open-source list:

- https://github.com/quran-center/quran-meta/blob/master/src/i18n/surah.ru.ts  
  Local snapshot: `content/tanzil/surah.ru.source.ts`

Arabic + English surah names remain from Tanzil `quran.json` (existing `apps/web/lib/surah-meta.ts` generator).  
Spanish / German / French / Urdu UI currently use English transliteration for surah titles until dedicated verified name lists are pinned.

## Product mapping

See `docs/TRANSLATIONS-AND-LOCALES.md`:

- UI `ar` → Arabic mushaf only (no translation tab)
- UI `en` → Arabic + `en.sahih`
- UI `ru` → Arabic + `ru.kuliev`
- UI `es` → Arabic + `es.garcia`
- UI `de` → Arabic + `de.bubenheim`
- UI `fr` → Arabic + `fr.hamidullah`
- UI `ur` → Arabic + `ur.maududi`

Web slim JSON (footnotes stripped for display): `apps/web/public/translations/`.

## License note

Respect Tanzil terms: keep attribution, do not alter the Quran Arabic text; translations are for display as published by the listed sources. Non-commercial use per Tanzil translation terms unless you obtain publisher permission.
