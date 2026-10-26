# Validation Review — Proposed 5-Layer Architecture
*Date: 2026-10-26 | Verdict: Adopt with corrections*

This document validates the Arabic architectural audit (LiveKit / Zipformer / Content SSoT / Rive / R2 + 4-phase SysAdmin plan) against production evidence and prior research.

---

## Overall Scorecard

| Layer | Claim | Verdict | Score |
|---|---|---|---|
| 1. LiveKit + Agents | Production-grade vs raw FastAPI WS | **Adopt** (with Cloud-first nuance) | 9/10 |
| 2. Zipformer + sherpa-onnx CTC | Pedagogy winner; phoneme aligner is hard | **Adopt for free/non-profit**; license caveat | 8/10 |
| 3. Content SSoT (Tanzil+QUA in DB) | No live API during recitation | **Adopt** (audio blobs → R2, not Postgres) | 9.5/10 |
| 4. Rive only; ban 3D VRM | Mid-phone disaster with three-vrm | **Adopt Rive as default**; “ممنوع 3D تماماً” slightly absolute | 8.5/10 |
| 5. Cloudflare R2 | Zero egress for Quran audio | **Adopt** | 10/10 |
| SysAdmin 4-phase order | DB → offline ASR → LiveKit → Avatar | **Adopt** (minor reorder notes) | 9/10 |

**Global verdict: ناجح ومعتمد كخط أساس للإنتاج — مع تعديلات إلزامية أدناه.**

---

## Layer 1 — LiveKit Realtime

### What is correct
- LiveKit as WebRTC SFU + Python Agent as a room participant is the right production pattern for a Virtual Sheikh.
- Raw FastAPI WebSockets carrying PCM for thousands of kids forces you to reinvent jitter buffers, NAT traversal, reconnect, AEC, and backpressure. LiveKit already owns that.
- Self-host dark side is real: UDP `50000–60000`, TCP `7881`, TURN on `443`/`3478`, host networking constraints, carrier CGNAT in MENA/Africa. Official LiveKit firewall docs confirm this.

### Corrections / nuance
1. **FastAPI WS is not “instantly catastrophic.”** Async Uvicorn can hold many sockets; the real choke is **per-session ASR CPU + media quality**, not the socket library. LiveKit still wins because of media plane, not because FastAPI “cannot do concurrency.”
2. **Donation strategy:** Prefer **LiveKit Cloud free/build tier first**, self-host later when traffic and ops budget justify it. Don’t start as full-time SFU SysAdmin.
3. Agent should do ASR/align/TTS; **do not** put heavy ONNX decode inside the Next.js process.

### Result
**Approved for production.** Cloud-first → self-host when ready.

---

## Layer 2 — CAPT (Zipformer + sherpa-onnx)

### What is correct
- CTC without LM is pedagogically correct (does not auto-correct the child).
- INT8 ~72MB + 320ms streaming chunks is a strong CPU path via `sherpa-onnx`.
- Phoneme output ≠ clean Arabic text; a **phoneme→ErrorLog** bridge is the real product difficulty.
- “Free platforms” framing correctly matches **NPL-1.2** constraints.

### Corrections / mandatory
1. **License:** `zipformer_p-arabic-v3` is **NPL-1.2 (No-Profit)**. Allowed for donation/free apps that do not charge for features it powers. **Forbidden** as the engine of a paid product. Parallel commercial track: `Abdou/quran-asr-tiny` (MIT) → self-trained CTC.
2. **Do not hand-roll a giant Mapping Matrix from scratch.** Prefer:
   - Canonical phonemes: `quran-transcript` / `quran_text2phoneme.json` / `ordered_quran_phonemes.json`
   - Diff: unit-level edit distance on phoneme tokens (not Unicode Uthmani strings)
   - Optional deep tajweed: `quran-muaalem` under **QML** terms
3. **Child gap:** under-12 PER can be 2–3× worse; UX must soft-fail (retry ayah, never harsh spam of false errors).
4. **Diacritic example** (`الحمدُ` vs `الحمدَ`): correct that Zipformer can hear it as phoneme change; map to structured JSON `{type, ref_index, expected_ph, hyp_ph, severity}` before any LLM.

### Result
**Technical winner for free/non-profit.** Ship a hardened **PhonemeAligner** module as Phase 2 exit criterion (not “nice to have”).

---

## Layer 3 — Content (@quranjs + Tanzil + QUA)

### What is correct
- QUA word/letter timings + children-repeat styles are the competitive timing source.
- **Never** hit live `@quranjs` / external Unicode variants during the hot recitation path — orthography drift kills alignment.
- Normalize once → Single Source of Truth.

### Corrections / nuance
1. **Split storage:**
   - **Postgres (Supabase):** surah/ayah/word rows, normalized Uthmani + Imlaei + phoneme strings, timing JSON, tajweed spans
   - **R2:** MP3/Opus blobs (EveryAyah / muallim packs) — **not** large audio inside Postgres
2. `@quranjs/api` remains useful as **seed/sync tooling** (admin job), not as runtime dependency on the child’s phone during recite.
3. Pin one orthography pipeline (e.g. Tanzil Uthmani + deterministic phonemizer) and version it (`content_version` column).

### Result
**Approved.** Strongest architectural correction in the audit.

---

## Layer 4 — Avatar (Rive vs three-vrm)

### What is correct
- Mid-range Android + WebView **VRM is a real risk**: field data shows ~700MB RAM class for three.js VRM on mid phones; thermal/battery/FPS pain; morph/bone limits break some devices.
- Lip-sync lag → child distrust is real for any avatar tech.
- Rive: small `.riv`, 60fps-class vector, same file web+RN, Agent drives visemes via LiveKit **Data Messages** — excellent fit.
- Prefer Rive as **default** for Virtual Kuttab kids phones.

### Corrections — do not over-absolutize
1. **“ممنوع استخدام الـ 3D تماماً” / “الخيار الوحيد”** is too absolute.
   - **Default = Rive (2D).**
   - **Optional later:** ultra-light 3D only on high-end / desktop parent demos, never required for core lesson path.
2. Rive is **not “fully free OSS end-to-end”**:
   - Runtimes = **MIT** (good)
   - Production **exports without splash** require paid Editor plan (Cadet ~$9/mo as of late 2025+)
   - Budget this in donation ops (tiny vs LiveKit/GPU)
3. Uncanny valley is mostly **sync quality + art direction**, not “3D vs 2D” alone. Bad Rive sync will also fail.
4. Fallback if Rive art bandwidth is slow: sprite mouth states + Lottie — still better than heavy VRM on low-end.

### Result
**Rive = primary avatar for v1.** Treat ban-on-3D as **product policy for child lesson path**, not a physics law.

---

## Layer 5 — Infra (Supabase + R2)

### What is correct
- R2 zero egress is strategically correct for Quran audio at scale on a donation model.
- Supabase Postgres + RLS fits parent/child COPPA-style tenancy.

### Minor adds
- Cache lesson packs at edge; signed URLs from R2
- Don’t stream child raw audio to object storage by default (privacy)
- Monitor Supabase row size if timing JSON is huge — normalize `word_timings` table

### Result
**Approved without material change.**

---

## SysAdmin Phase Plan — Validation

| Phase | Your plan | Verdict |
|---|---|---|
| 1. Unified DB + Tanzil/QUA normalized | Correct first move | **Go** — also seed R2 audio packs + `content_version` |
| 2. Voice without avatar: FastAPI + sherpa + Zipformer + Aligner WER tests | Correct | **Go** — add golden set of child/adult clips; gate on ErrorLog schema quality |
| 3. LiveKit Agent realtime + viseme events | Correct | **Go** — start LiveKit Cloud if ops thin |
| 4. Rive Sheikh + Data Messages | Correct last | **Go** — art + state machine after audio truth exists |

**Do not** build Rive or LLM Sheikh before Aligner quality is proven. Your order is right.

---

## Adopted Stack (post-validation)

```
Realtime:   LiveKit Cloud (first) → self-host SFU later
CAPT:       sherpa-onnx + Zipformer (NPL/free) | MIT tiny / self-train (commercial track)
Aligner:    phoneme edit-distance → ErrorLog JSON (mandatory module)
Content:    Supabase SSoT (text/phonemes/timings) + R2 (audio blobs)
Avatar:     Rive primary (child path) · 3D optional later/high-end only
TTS:        Piper/Habibi for Sheikh phrases only · human qari for ayahs
Hosting:    Supabase + Cloudflare R2 + LiveKit + CPU ASR box
```

---

## Final Arabic Verdict (short)

التحليل المقدَّم **ناضج وصالح كخط أساس إنتاجي**. أقوى قراراته: LiveKit، محتوى موحّد بلا API حي أثناء التسميع، Rive بدل VRM الثقيل، وR2. أهم التصحيحات: ترخيص NPL لنموذج Zipformer، فصل الصوت عن Postgres، عدم المبالغة بـ«ممنوع 3D للأبد»، والبدء بـ LiveKit Cloud إن ضعفت ميزانية الـ SysAdmin.
