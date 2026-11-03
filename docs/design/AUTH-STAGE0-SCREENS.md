# Stage 0 — Auth UI/UX screen structure

**Locked product decisions:** `docs/AUTH-REGISTRATION-PHASE-PLAN.md` (2026-11-03)  
**Visual system:** Concept A — كُتّاب المصباح (`DESIGN.md` + `design-tokens.json`)  
**Skills applied:** `vk-listen-recite-ui` · `make-interfaces-feel-better` · existing home/settings patterns  

**Rule:** Auth never blocks Listen → Recite. Guest remains first-class. Account is optional sync.

**Interactive wireframes:** open `docs/design/auth-stage0-wireframes.html` in a browser.

---

## 1. Skills → screen rules

| Source | Applied rule |
|---|---|
| vk-listen-recite-ui | One primary CTA per screen; large Arabic type; RTL; calm, no shame copy |
| DESIGN.md | Sage primary, paper/night surfaces, no SaaS purple; brand quiet; 390×844 first |
| make-interfaces-feel-better | ≥44px hit targets; `tabular-nums` for ages/phones; no `transition: all`; explicit field errors |
| P0/P1 home polish | Soft entry from toolbar/settings; in-app sheets not OS chrome; guest Continue unchanged |

---

## 2. Information architecture (Stage 0 only)

```
Home / Settings
  └─ «حسابي» soft entry
        ├─ /login
        │     ├─ forgot → /forgot-password  (email only)
        │     └─ no account? → /register
        ├─ /register
        │     ├─ step role → form → success → home (merged guest)
        │     └─ have account? → /login
        └─ /reset-password   (from email link hash; not in nav)
```

**Out of Stage 0 UI:** parent dashboard, add-kid, admin, leaderboard, phone/username login (login Stage 0 = email **or** username + password; phone collected on register only).

---

## 3. Screen inventory

| ID | Route | Job | Primary CTA | Secondary |
|---|---|---|---|---|
| A0 | Entry chip | Open account without leaving lesson path | «دخول» / «حسابي» | — |
| A1 | `/login` | Sign in | «دخول» | Forgot · Create account · Continue as guest |
| A2 | `/register` | Create student or parent | «إنشاء حساب» | Login · Guest button |
| A3 | `/forgot-password` | Request email reset | «إرسال الرابط» | Back to login |
| A4 | `/reset-password` | Set new password from email | «حفظ كلمة المرور» | — |
| A5 | Logged-in chip | Show **display name** (not @username); logout | «خروج» | Settings link |

---

## 4. Field specs

### A2 Register

| Field | Required | Notes |
|---|---|---|
| Role | Yes | Segmented: **طالب** / Student (`learner`) · **ولي أمر** / Parent (`parent`) |
| Display name | Yes | Shown in UI (not unique) |
| Username | Yes | **Unique**, `[a-z0-9_]{3,24}`, Latin digits; shown as `@name` |
| Country + phone | Yes | Country select + national number → E.164 validate; **no SMS** |
| Age | Optional | Number; **never blocks** signup (any age allowed) |
| Email | Yes | Login + reset channel |
| Password | Yes | Min 8; show/hide toggle |
| Confirm password | Yes | Must match |

After success: merge guest localStorage progress (D5), land on Home signed-in.

### A1 Login

| Field | Required | Notes |
|---|---|---|
| Identifier | Yes | **Email or username** (Stage 0). Phone alias = Stage 2 |
| Password | Yes | Show/hide |

### A3 Forgot / A4 Reset

- Forgot: email only → «تحقق من بريدك».
- Reset: new password + confirm (token from Supabase recovery URL).

---

## 5. Layout structure (mobile-first)

Shared chrome for A1–A4 (matches browse/settings):

```
┌─────────────────────────────┐
│ [←]     الكُتَّاب أون لاين      │  quiet brand, back → home
│                             │
│     {screen title}          │
│     {one short subtitle}    │
│                             │
│     [ fields… ]             │  one column, 44px controls
│                             │
│     [  PRIMARY CTA  ]       │  full-width sage
│     text links (forgot…)    │  switch auth mode
│     [ متابعة دون تسجيل ]    │  full-width guest button (distinct color)
└─────────────────────────────┘
```

- **Guest button:** not a text link — full-width, min-height 44px, muted surface + clear border (ink-mute / line), not sage; sits below auth links so it stays visible.
- **One composition** — no dashboard cards stacked for auth.
- Night theme: reuse `--vk-*` night tokens already on site.
- Errors: inline under field + one summary `role="alert"`; never toast over CTA.
- Loading: disable primary + `aria-busy`; keep layout height stable.

### Home entry (A0)

Toolbar gains a quiet **حساب** chip (or replace nothing critical):

- Logged out → `/login`
- Logged in → chip shows **display name** (الاسم), never `@username` in the toolbar
  - Max width ~7–9rem on 390px; single line; `ellipsis` if long so the toolbar stays one row
  - Full name available via `title` / aria-label; sheet: Settings · Logout

Lesson header: **do not** add auth chrome; keep ayah hero free.

---

## 6. Copy keys (i18n — ar / en / ru)

Namespace `auth.*` (to add in Stage 0 impl):

- `auth.loginTitle`, `auth.registerTitle`, `auth.forgotTitle`, `auth.resetTitle`
- `auth.roleStudent` (طالب), `auth.roleParent` (ولي أمر)
- `auth.displayName`, `auth.username`, `auth.phone`, `auth.country`, `auth.age`, `auth.email`, `auth.password`, `auth.confirmPassword`
- `auth.loginId` (email or username)
- `auth.submitLogin`, `auth.submitRegister`, `auth.sendReset`, `auth.savePassword`
- `auth.continueGuest` — **full-width button**, distinct from primary (muted outline / ink-mute), always visible under primary + text links
- `auth.haveAccount`, `auth.noAccount`, `auth.forgotLink`
- `auth.mergeGuestHint` — short note that local progress will sync
- Validation: `auth.errUsernameTaken`, `auth.errPhoneInvalid`, `auth.errEmail`, `auth.errPasswordShort`, …

Tone: calm kuttab Arabic; no “verify your identity to continue learning” pressure.

---

## 7. States & empty / error

| State | UI |
|---|---|
| Idle | Fields empty / prefilled country from locale heuristic |
| Submitting | Primary disabled, spinner or «جاري…» |
| Field invalid | Red soft border + hint (non-color: text) |
| Username taken | Inline under username |
| Auth failed | Summary alert; password cleared optionally |
| Reset email sent | Success panel, no second form |
| Recovery link bad/expired | Calm message + link to forgot again |
| Guest merge | Silent or one-line «تم حفظ تقدّمك في الحساب» on Home |

---

## 8. Accessibility

- `dir` / `lang` from i18n provider (RTL for ar).
- Labels associated with inputs; errors `aria-describedby`.
- Focus ring = `--vk-focus`.
- Password toggle must be a real button with accessible name.
- Country list searchable or long-list friendly on mobile.

---

## 9. Approval gate

Before Stage 0 **code**:

- [ ] Confirm screen list A0–A5
- [ ] Confirm register fields (username unique, phone no SMS, age optional/non-blocking)
- [ ] Confirm login = email **or** username + password (phone login later)
- [ ] Confirm soft entry only (guest Continue stays primary when progress exists)
- [ ] Role label = **Student / طالب** (not Individual)
- [ ] Logged-in chip = **display name** (ellipsis), not @username
- [ ] «متابعة دون تسجيل» = distinct full-width button (not a text link)
- [ ] Visual OK on wireframes HTML (cream + night)

**Reply «approve screens»** (or list edits) → then implement Stage 0.
