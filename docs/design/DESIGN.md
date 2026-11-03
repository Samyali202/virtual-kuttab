# Virtual Kuttab — Design System

**Locked:** 2026-10-28  
**Direction:** Concept **A — كُتّاب المصباح** (Kuttab Lamp)  
**Source of truth for product:** `docs/PRODUCT-DECISION-TARTEEL-STYLE-HIFZ.md`  
**Source of truth for this system:** expert opinion `docs/design/expert-opinion-before-system.html`  
**Tokens file:** `docs/design/design-tokens.json`  
**Mood board (not constitution):** `docs/design/concept-ab-mockups.html`

This document freezes visual and interaction rules for the **lesson screen** (Listen → Repeat → Recite → word feedback). Implement UI against these tokens and states — not against the live beige form, and not against mockup A pixel-for-pixel.

---

## 1. Verdict (locked)

| Decision | Choice |
|---|---|
| Visual direction | **A — كُتّاب المصباح** |
| From B (optional later) | Cleaner surah chips + quieter borders only — **never** replace lamp active-word with underline-only |
| Tone | Warm kuttab room: respect, calm, paper + sage + lamp gold — not SaaS, not AI purple |
| Hero | Uthmani **ayah text** is always the largest, central element |
| Teacher audio | **Husary Muallim only** — custom progress bar, never native `<audio controls>` chrome |
| Feedback | Word-level only; cap visible errors **1–2**; quiet message; no tajweed badges |
| Accessibility | **WCAG 2.2 AA** on target viewports |

---

## 2. Product contract (screen)

| Field | Spec |
|---|---|
| Job | One-ayah lesson: listen to Muallim, then record; get word-level feedback |
| Hero | Tanzil Uthmani ayah text |
| Primary actions | **استمع** then **سجّل** (dock) |
| Secondary | Surah/ayah pick, sensitivity (طفل / مبتدئ / محترف), optional كرّر |
| Brand | «الكتّاب الافتراضي» present but never larger than the ayah |
| Direction | `dir="rtl"` real layout (not mirrored LTR) |
| Target viewports | **390×844** (mobile), **1280×800** (desktop) |
| Success copy | **أحسنت** |
| Grading meaning | Green/red = text align vs pinned ayah — **not** audio fingerprint vs Sheikh MP3 |

---

## 3. Screen hierarchy

Top → bottom (mobile lesson):

1. **Brand + quiet subtitle** (small)
2. **Sensitivity** near the ayah (lesson setting, not dashboard filters)
3. **Surah / ayah pick** (compact chips)
4. **Ayah stage** (flex-grow; vertical center) ← hero
5. **Quiet meta** (سورة · آية) under ayah
6. **Dock** (fixed thumb zone): custom listen progress + استمع / سجّل + status line

Rules:

- One composition, not a dashboard.
- No cards-inside-cards.
- No marketing or stats above the ayah.
- Sensitivity and pickers must not overpower brand or ayah.

---

## 4. Interaction states (must implement)

| State | User sees | Next action |
|---|---|---|
| `loading_ayah` | Stable ayah skeleton / pulse | Wait or change surah |
| `empty_audio` | Calm Arabic message: no Muallim file | Pick another ayah |
| `idle` | Ayah clear; dock ready | استمع or سجّل |
| `listening` | **Lamp** on active word + custom progress | Optional stop |
| `recording` | Clear pulse on record control + stop | Stop → score |
| `scoring` | Words pending / short wait; no fake errors | — |
| `success` | أحسنت; soft emphasis, no loud confetti | Next ayah / re-listen |
| `retry` | At most **1–2** words marked wrong + short message | Record again / listen |
| `mic_denied` | Arabic explanation | Open browser settings |

Motion must respect `prefers-reduced-motion: reduce` (instant state change, no glow pulse).

---

## 5. Word feedback language

| Class | Visual | Non-color cue (required) |
|---|---|---|
| Default | Ink on paper | — |
| `word-active` (listen) | Lamp fill + soft ring | `aria-current="true"` / live announcement optional |
| `word-ok` | Soft sage fill | Optional check icon only if density allows |
| `word-bad` | Soft clay fill | Underline **or** short label in status (`أعد: …`) — never color alone |
| Cap | Show **≤ 2** bad words per turn | Rest stay neutral; message names the focus words |

Do **not** paint the whole ayah red/green after score. Preserve calm; child-safe shame avoidance.

---

## 6. Design tokens

Implement as CSS variables on `:root` (and optionally import from `design-tokens.json`).

### 6.1 Color

| Token | Value | Role |
|---|---|---|
| `--vk-paper-0` | `#f8f1e6` | Page top / warm field |
| `--vk-paper-1` | `#efe4d2` | Page bottom gradient |
| `--vk-paper-glow` | `#fff6e4` | Soft radial lamp wash (decorative only) |
| `--vk-surface` | `#fffcf5` | Dock / elevated strip |
| `--vk-ink` | `#1c1917` | Primary text |
| `--vk-ink-mute` | `#57534e` | Secondary text |
| `--vk-line` | `#ddcfb8` | Borders / hairlines |
| `--vk-sage` | `#2f6b4f` | Primary actions, brand accent |
| `--vk-sage-soft` | `#e7f2eb` | Selected level chip bg |
| `--vk-sage-ink` | `#1e4d38` | Text on sage-soft |
| `--vk-lamp` | `#f3e0a8` | Active word fill |
| `--vk-lamp-ring` | `#c4a35a` | Active word ring / progress fill |
| `--vk-ok` | `#146c3a` | Correct word text |
| `--vk-ok-soft` | `#d8f0e0` | Correct word fill |
| `--vk-bad` | `#8b2e22` | Wrong word text |
| `--vk-bad-soft` | `#f8d9d4` | Wrong word fill |
| `--vk-focus` | `#2f6b4f` | Focus ring (3px outline + 2px offset) |

**Contrast (AA):**

- Body / ayah ink `#1c1917` on paper `#f8f1e6` / `#efe4d2` → pass.
- Active word ink `#1c1917` on `#f3e0a8` → pass; **do not rely on glow alone**.
- Primary button white on `#2f6b4f` → pass.
- Soft gold (`#c4a35a`) is **accent only**, never sole text color on paper.

**Forbidden palettes:** purple→indigo AI gradients; neon; glass/neumorphism on ayah; cold pure `#fafafa` as the default lesson field (that is Concept B).

### 6.2 Typography

| Token | Spec |
|---|---|
| `--vk-font-ayah` | `"Amiri", "Noto Naskh Arabic", "Traditional Arabic", serif` |
| `--vk-font-ui` | `"IBM Plex Sans Arabic", Tahoma, sans-serif` |
| `--vk-ayah-size` | `clamp(1.45rem, 4.2vw, 1.85rem)` |
| `--vk-ayah-lh` | `2.2` |
| `--vk-ui-size` | `0.95rem` |
| `--vk-meta-size` | `0.75rem` |
| `--vk-brand-size` | `1.05rem`–`1.15rem` (weight 700) |

Ayah is centered, RTL, Uthmani. UI labels use IBM Plex Sans Arabic. Never Inter/Roboto/Arial as the design voice.

### 6.3 Space & radius

| Token | Value |
|---|---|
| `--vk-space-1` | `4px` |
| `--vk-space-2` | `8px` |
| `--vk-space-3` | `12px` |
| `--vk-space-4` | `16px` |
| `--vk-space-5` | `20px` |
| `--vk-space-6` | `24px` |
| `--vk-radius-word` | `6px` |
| `--vk-radius-chip` | `8px` |
| `--vk-radius-btn` | `12px` |
| `--vk-radius-dock` | `0` (full-bleed strip) |
| `--vk-touch-min` | `44px` |

Page padding: `16–20px` sides. Dock padding: `16px 20px 24px` (safe-area aware).

### 6.4 Elevation & texture

- Page: light radial wash + vertical paper gradient (see Concept A mock).
- Texture: **none or hairline SVG noise ≤ 3% opacity** — no heavy paper bitmap (perf + calm).
- Shadows: at most one soft dock shadow `0 -8px 24px rgba(28,25,23,0.06)`. No multi-layer glam.

### 6.5 Motion

| Token | Value | Use |
|---|---|---|
| `--vk-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | Buttons, dock |
| `--vk-dur-fast` | `120ms` | Press / word handoff |
| `--vk-dur-med` | `220ms` | State enter |
| Lamp pulse | optional `opacity 0.85↔1` at 1.2s | **Off** when `prefers-reduced-motion` |

Allowed motion: word lamp handoff, record pulse, button press.  
Disallowed: scroll-jacking, loud confetti, parallax, 3D.

---

## 7. Components (v1 lesson)

### 7.1 Brand header
Small title «الكتّاب الافتراضي»; one short supporting line. Not a marketing hero.

### 7.2 Sensitivity control
Three equal segments: طفل · مبتدئ · محترف. Selected = sage-soft + sage border. Place **under brand / above or beside ayah meta**, not as admin toolbar.

### 7.3 Surah / ayah chips
Compact; prefer Concept B’s quieter border treatment if chips feel busy. Numeric tabular where useful.

### 7.4 Ayah stage
Full width of content column; words are `inline-block` with word tokens. Active = lamp. After score = ok/bad on ≤2 words.

### 7.5 Listen bar (custom)
Track `--vk-line` / fill `--vk-lamp-ring`. Play/pause + progress. **Replace** browser native audio UI.

### 7.6 Action dock
Two primary-width controls: استمع (primary sage), سجّل (secondary outline sage) — swap emphasis when in `recording` (سجّل becomes destructive/stop). Touch ≥ 44×44.

### 7.7 Status / live region
`aria-live="polite"` for أحسنت / أعد / mic errors. One short Arabic sentence.

### 7.8 Avatar (optional v1)
Static Sheikh only if it does not steal ayah focus; never invents corrections.

---

## 8. Accessibility checklist (ship gate)

- [ ] Contrast ≥ 4.5:1 for text; UI components ≥ 3:1 where required  
- [ ] Visible `:focus-visible` ring (`--vk-focus`)  
- [ ] Full keyboard: pick ayah, play/stop, record/stop, change level  
- [ ] Touch targets ≥ 44×44 (children)  
- [ ] `dir="rtl"` + logical properties (`margin-inline`, etc.)  
- [ ] Status via `aria-live` — not toast-only color  
- [ ] Wrong words not color-only  
- [ ] `prefers-reduced-motion` honored  
- [ ] Mic permission copy in Arabic with recovery path  

---

## 9. Do / Don’t

**Do**

- Ayah first; lamp for listening word  
- Custom Muallim progress  
- Cap corrections; calm أحسنت  
- RTL-native layout  
- Sustainable light UI (few assets)

**Don’t**

- Purple SaaS gradients, glass, neumorphism on mushaf  
- Tajweed color codes / rule badges  
- Native `<audio controls>` as the product chrome  
- Cards nested in cards  
- 3D / VRM / loud celebration  
- Dark mode in v1 (defer; if ever, re-prove AA)  
- Hide ayah behind promo chrome  

---

## 10. Implementation map

| Artifact | Path |
|---|---|
| This constitution | `docs/design/DESIGN.md` |
| Machine tokens | `docs/design/design-tokens.json` |
| Expert rationale | `docs/design/expert-opinion-before-system.html` |
| Mood A/B | `docs/design/concept-ab-mockups.html` |
| App CSS entry | `apps/web/app/globals.css` → map to `--vk-*` |
| Lesson UI | `apps/web` Listen/Recite surfaces |

**Change control:** palette or hierarchy changes require updating this file first. Mockups do not override DESIGN.md.

---

## 11. Out of scope (design)

- Marketing landing redesign  
- Multi-qari picker UI  
- Tajweed visualization  
- Dark theme  
- Desktop-only dense dashboards  

---

*End of design system v1 — Concept A locked.*
