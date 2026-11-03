# Virtual Kuttab — Registration & sync phase (approval gate)

**Status:** decisions **locked 2026-11-03** — Stage 0 + admin console **in progress / shipped scaffold**  
**Authors:** Architecture + senior engineering review (2026-11-03)  
**Constraint:** Listen → Repeat → Recite guest UX keeps working; accounts are additive.  
**UI/UX SSoT for this phase:** `docs/design/AUTH-STAGE0-SCREENS.md` + `docs/design/auth-stage0-wireframes.html`  

**Admin (separate URL):** student/parent → `/login` · ops admin → `/vk-ops-console/login` (not linked from public UI). Super-admin credentials: private secrets file `vk-superadmin.credentials.env` (never commit).

---

## 1. Verdict (both reviews)

| Finding | Detail |
|---|---|
| Backend head-start | Supabase already has `profiles` (`learner` / `parent` / `admin`), `ayah_attempts` + RLS, and `handle_new_user` trigger (`supabase/migrations/20261028170000_init.sql`). Lesson already inserts attempts when a session exists. |
| Frontend gap | Guest-only UI today (`lib/progress.ts` → localStorage). No register/login screens. |
| Hosting | Keep `output: "export"` (static on Hetzner). Auth = browser Supabase client + RLS. No need to abandon static hosting for this phase. |
| Hard Supabase constraint | **Phone+password and username+password are not native.** Native Auth is email+password (and phone **OTP**, not phone+password). Alias login (phone/username → email) needs a small Edge Function later. |
| Recommendation | Ship **email+password** as the real identity first; store **validated E.164 phone** + **display name** on `profiles`; add phone/username login in Stage 2. |

Guest flow stays: open site → Listen/Recite → local progress. Registered flow: same lesson, progress also written to Supabase and restored on any device after login.

---

## 2. Clarified product model (proposed)

| Role | Who | Capabilities (this phase) |
|---|---|---|
| **Guest** | No account | Full lesson; progress/stats local only |
| **Student** | Self-registered learner (`role=learner`, UI: طالب / Student) | Own profile + cloud progress |
| **Parent** | Self-registered (`role=parent`) | Own profile + create/link kids + view kid progress + reset kid password |
| **Kid** | Parent-created (preferred) or self-reg if age ≥ threshold | Own login + progress; parent can view/reset |
| **Admin** | Later | All users, progress, rate limits — **not Stage 1** |

**Registration (student or parent):** country code + phone (validated format), display name, age, email, password.  
**Login Stage 1:** email + password.  
**Login Stage 2:** phone **or** email **or** username → resolve to email → password.  
**Password reset:** email only (Supabase recovery link → static `/reset-password` page).

---

## 3. Decisions — LOCKED 2026-11-03

| # | Decision | Locked choice |
|---|---|---|
| **D1** | Phone / OTP | **No SMS.** Phone = validated profile field (country code + number → E.164). Any OTP/verification uses **email only** (Supabase confirm / reset). |
| **D2** | Username | **Unique username** — login identifier (plus email; phone alias in Stage 2). |
| **D3** | Kid / age gate | **No age restriction** for login or self-registration. Spiritual learning product; age may still be collected as profile info, never as a blocker. Parent may still create kid accounts in Stage 2. |
| **D4** | Email confirm | Staging optional; production once SMTP ready. |
| **D5** | Guest → account | **Yes** — merge local progress when user registers/logs in. |
| **D6** | Stage order | **0 → 1 → 2 → 3** strictly. |
| **D7** | UI before code | Stage 0 **screens/structure approved** via design docs before app implementation. |

---

## 4. Target data model (extends existing)

Keep: `profiles`, `ayahs`, `ayah_audio`, `ayah_attempts`.

Add / extend:

| Table / column | Purpose |
|---|---|
| `profiles.phone_e164` | Unique nullable; validated country+number |
| `profiles.username` | Nullable unique (Stage 2) or omit until needed |
| `profiles.display_name` | Name shown in UI |
| `profiles.age` / `birth_year` | Age at registration (prefer birth year later if you need aging) |
| `profiles.role` | Already: `learner` \| `parent` \| `admin` |
| `family_links` | `parent_id`, `child_id`, `created_at` — parent↔kid |
| `hifz_bookmarks` (or sync of local progress) | Per-user “continue” surah/ayah + last result |
| `auth rate / admin` | Stage 3 — Edge Function + DB counters or Supabase rate limits |

**RLS principles**

- User reads/writes own profile, attempts, bookmarks.
- Parent **select** on linked children’s progress via `family_links`.
- Parent does **not** get arbitrary update on child attempts; password reset via **Edge Function** (service role) after parent auth check.
- Admin policies only when `profiles.role = 'admin'`.

---

## 5. Phased delivery (approval-gated)

### Stage 0 — Auth scaffold (no family yet)
**Build:** browser Supabase session context; `/register`, `/login`, `/reset-password`; register stores phone/name/age on `profiles`; email+password Auth; guest unchanged.  
**Exit:** can register, login, logout, reset via email on staging; lesson still works logged out.

### Stage 1 — Progress sync (MVP “move device to device”)
**Build:** write-through bookmark + attempts when logged in (extend existing lesson insert); on login merge localStorage → cloud; home “Continue” reads cloud if session.  
**Exit:** same account on two browsers shows same continue point + attempts history; guest still local-only.

### Stage 2 — Family (parent + kids)
**Build:** parent dashboard; add kid (name, age, credentials); `family_links`; parent progress view; parent reset-kid-password Edge Function; optional alias login (phone/username).  
**Exit:** parent creates kid → kid logs in on another device → parent sees kid progress.

### Stage 3 — Admin + anti-spam ✅ (2026-11-03)
**Build:** ops console disable/enable + filters; `profiles.disabled`; `rate_limits` + `consume_rate_limit`; rate limits on register/login/reset (+ parent create/reset); `admin_audit` + `admin_set_user_disabled`; Edge `admin-create-user` / `admin-reset-password` + ops UI (**Create user**, **Reset PW**).
**Exit:** admin can create student/parent, reset any non-admin password, disable/throttle abusive accounts; leaderboard still **out of scope**.

### Ops admin how-to (Stage 3)

1. Open `/vk-ops-console/login` (not linked from public UI) → sign in as admin.
2. **Create student or parent:** **Create user** → role Student|Parent → display name, username, email, password (min 8) → **Create account**. Email is auto-confirmed.
3. **Reset password:** row **Reset PW** → enter new password → **Save password**. Cannot reset other admins or yourself.
4. **Disable / enable:** row **Disable** / **Enable** (not for admins).

**Non-goals this phase:** leaderboard, SMS OTP as primary auth, tajweed, changing ASR host, abandoning static export.

---

## 6. Stage 1 engineering slice (after approval)

Approximate surface (senior eng estimate):

- Upgrade client session handling (`@supabase/ssr` browser client or keep JS client + `onAuthStateChange`)
- Screens: register, login, forgot/reset password (AR/EN/RU)
- `profiles` migration: phone_e164, age, maybe birth_year
- `hifz_bookmarks` + RLS
- `lib/progress.ts`: dual-write when `session`; merge helper on login
- Soft “حساب” entry on home/settings — never block Listen
- Phone UI: country select + national number → E.164 validate (`libphonenumber` / similar)

~15–20 files; ASR/Hetzner untouched.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Kids privacy / COPPA-like | Prefer parent-created under 13; no public kid PII; RLS; no leaderboard yet |
| Spam registrations | Stage 3 rate limit; Stage 0 can add honeypot + CAPTCHA later |
| Static export = no SSR middleware | Rely on RLS; never put service key in the web app |
| Phone-as-login expectation | Document Stage 1 = email login; phone collected for later alias |
| Reset email deliverability | Configure SMTP before marketing “reset works” |
| Dual progress sources | Explicit merge rules; never wipe cloud blindly |

---

## 8. Approval checklist

Product owner: reply with **Approve** (and overrides) for:

- [ ] D1 Phone = profile-only (A) / OTP (B)
- [ ] D2 Username = display name (A) / login handle (B)
- [ ] D3 Kid self-reg min age = ___ (recommend 13); under-age = parent-created only
- [ ] D4 Email confirm = optional staging / required prod
- [ ] D5 Guest merge on login = yes
- [ ] Phases Stage 0 → 1 → 2 → 3 as above
- [ ] Leaderboard + admin UI deferred to Stage 3 / later

After approval, implementation starts at **Stage 0** only.
