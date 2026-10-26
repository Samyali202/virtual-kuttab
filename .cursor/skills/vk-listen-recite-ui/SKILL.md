---
name: vk-listen-recite-ui
description: >-
  Build Virtual Kuttab Listen / Repeat / Recite UI in Next.js with word
  highlight and green-red feedback. Use when implementing apps/web lesson
  pages, mic recording, avatar shell, or Hifz progress screens.
---

# VK Listen / Recite UI

## Screens (v1)

1. **Pick ayah** — surah/ayah list  
2. **Listen** — play Husary + karaoke word highlight  
3. **Repeat** — same player; optional pause between ayahs  
4. **Recite** — MediaRecorder → POST `/score` → paint word statuses  
5. **Result** — “أحسنت” or list 1–2 mistakes + replay Husary for that word  

## UI rules

- Simple, large Arabic type, RTL  
- Green = OK, amber/red = error, no shame copy  
- Avatar: static image OK; Rive optional later  
- Do not show tajweed rule names as AI verdicts  

## Web stack

- `apps/web` — Next.js App Router  
- Call ASR: `NEXT_PUBLIC_ASR_URL` default `http://127.0.0.1:8088`  
- Supabase client for auth/progress when wired  

## Recite client sketch

```ts
const form = new FormData();
form.append("audio", blob, "recite.wav");
form.append("surah", String(surah));
form.append("ayah", String(ayah));
form.append("reference_text", referenceUthmani);
const res = await fetch(`${ASR_URL}/score`, { method: "POST", body: form });
const log = await res.json();
// log.words[].status → color each mushaf word
```

## Accessibility

- Mic permission with clear Arabic prompt  
- Works on mobile Safari/Chrome PWA  
- Prefer one primary CTA per screen
