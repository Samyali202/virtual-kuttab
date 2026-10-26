# Virtual Kuttab — Bulletproof Architecture Verdict
*Validated by: Principal Architect + Senior Software Engineer (Claude Opus 4.8)*  
*Date: 2026-10-26 | Status: OFFICIAL DECISION RECORD*

> **Honest statement first:** No system can be “100% error-free” on child Quran ASR. SOTA phoneme mispronunciation precision on *adults* is ~0.37 (Iqra’Eval 2025). Children are worse.  
> **What “bulletproof / production-valid” means here:** measured false-correction rate below hard gates, silence when unsure, human teacher backstop, license-safe, maintainable by a small team.

---

## 1. Executive Verdict (One Page)

### Product north star
**Never lie to the learner.** A missed error is recoverable. A false correction destroys trust — especially for children.

### Final stack (v1 = MVRA)

| Layer | Decision | Why |
|---|---|---|
| Teaching core | **Listen (human qari) → Recite → Word-level score → Gentle template feedback** | Matches how Tarteel ships today (word mistakes, **not** tajweed) |
| ASR | **On-device `sherpa-onnx` + MIT `quran-asr-tiny` (or self-trained CTC)** | Privacy, low ops, license-safe; NPL models only if product stays free forever |
| Judging | **Word presence/order only in v1** (delete/insert/substitute) | Phoneme/tajweed scoring deferred until child FP-rate proven |
| Transport | **Record-per-ayah / short PCM WebSocket — NOT LiveKit in v1** | Loop is turn-based, not duplex voice chat |
| Content | **Supabase SSoT (Tanzil+timings) + R2 audio** | No live external API during recite |
| Avatar | **Static Sheikh + CSS mouth + prebaked Piper** in v1; **Rive deferred** | Avatar makes wrong feedback feel authoritative |
| LLM Sheikh | **Deferred** | Templates until ASR trusted |
| LiveKit / Rive / phoneme MDD / server GPU | **Phase 3+ only** | Behind exit criteria |

### What we searched and rejected as “better”
| Candidate | Result |
|---|---|
| Tarteel developer API | **Does not exist** (Sept 2025). QUL = downloadable data only |
| Tarteel for tajweed | Official: **AI does not detect tajweed yet** |
| LiveKit for core loop | Over-engineered for turn-based recite→grade |
| Streaming Zipformer as *judge* | Authors warn: not a standalone judge; weak on children; hears rule not deviation |
| three-vrm / photoreal talking head | Mid-phone RAM/thermal disaster |
| Building avatar+LLM in parallel with unproven ASR | Amplifies false corrections |

### Reference open projects (steal architecture, don’t copy licenses blindly)
- [Itqan](https://github.com/IemProg/itqan) — on-device Flutter CAPT reference (verify model licenses)
- [Hifz Tester](https://github.com/foyzulkarim/hifz-tester) — word-level only, honest about FP risk
- [Quran Lab](https://quranlab.ai/) — on-device phoneme SOTA (NPL)
- [Quran Muaalem](https://obadx.github.io/quran-muaalem/en/) — deep tajweed research path
- [Mahfuz](https://github.com/theilgaz/mahfuz) — kids curriculum/UX scaffold

---

## 2. Architect Keep / Replace / Add

| Component | Old proposal | Verdict |
|---|---|---|
| Quran-Lab / Muaalem *family* | Keep as research SOTA | **Keep family knowledge**; careful which variant judges |
| Streaming Zipformer as judge | Primary | **REPLACE** — highlight-only later; judge = offline / word-level first |
| LiveKit + Agents | Primary realtime | **REPLACE for v1** — WebSocket/record; LiveKit only for future live tutor |
| On-device inference | Secondary | **ADD as primary** |
| Rive avatar | Primary UI | **DEFER** until FP gate passed; static face in v1 |
| Supabase + R2 + Tanzil SSoT | Keep | **KEEP** |
| Never TTS ayah | Keep | **KEEP (non-negotiable)** |
| Human escalation | Missing | **ADD mandatory** |
| Precision-first gate | Weak | **ADD as product law** |

---

## 3. Bulletproof Teaching Loop (Error-Minimizing)

```
1. LISTEN ALWAYS     Human qari from R2 + word highlight (QUA/align timings)
2. RECITE ONE AYAH   Mic → on-device ASR (word/letter hypothesis)
3. AUDIO GATE        Bad SNR / weak VAD → "لم أسمع جيداً، أعد" — NEVER correct
4. ALIGN WORDS       Edit-distance vs pinned Uthmani/Imlaei reference (content_version)
5. CONSENSUS         flag = mismatch AND low segment confidence AND good audio
6. CHILD POLICY      ≤1 correction/turn; listen-before-retry (replay qari word)
7. SILENCE ON DOUBT  Ambiguous → praise effort + replay ayah — no red X
8. ESCALATE          Low-conf clips → optional human teacher queue (parent consent)
9. DISCLAIMER        "مساعد تقني وليس بديلاً عن معلّم مؤهّل"
```

**v1 scores:** words only.  
**v1 does NOT score:** fine tajweed (ikhfaa, free madd, etc.) — display colors only.  
**Why:** Even Tarteel’s commercial product does not ship tajweed mistake detection yet.

---

## 4. Production-Valid SLOs (Hard Gates)

| Metric | Child mode (ship gate) | Adult mode |
|---|---|---|
| **False-positive rate** on correct clips | **< 5%** | < 3% |
| Recall on known single-word errors | ≥ 50% OK | ≥ 70% |
| Bad-audio → “ask repeat” (no correction) | > 90% | > 90% |
| Word alignment vs labels | ≥ 95% | ≥ 95% |
| E2E recite → feedback | < 2.0 s | < 2.0 s |
| Corrections when confidence < τ | **0%** | **0%** |
| Fine tajweed auto-judgment | **OFF** | OFF until validated |
| Age < 6 auto-correction | **OFF** (listen + highlight only) | — |

**Release rule:** If child FP-rate fails → **do not ship correction**. Ship listen + highlight + Hifz tracker only.

---

## 5. Minimal Viable Reliable Architecture (2-person team)

```
Expo app + Next.js PWA
  ├─ Mushaf (SSoT text) + word highlight
  ├─ Human qari (R2)
  ├─ On-device sherpa-onnx (MIT tiny) → word ErrorLog
  ├─ Templates (Arabic) + listen-before-retry
  └─ Static Sheikh + CSS mouth + Piper praise clips

Supabase = Auth + RLS + progress DB
Cloudflare R2 = audio packs

CUT from v1: LiveKit, GPU ASR farm, LLM, Rive, phoneme tajweed scoring
```

**Ops burden:** ~3 managed services + app binary.

---

## 6. Phased Build (Exit Criteria Required)

### Phase 0 — Content + Golden Dataset
- Normalize Tanzil + timings → Postgres; audio → R2; `content_version`
- Build golden set: correct / known-error / bad-audio / child+adult
- *Exit:* mushaf+qari works offline; golden set versioned; replay harness runs

### Phase 1 — Word-level teaching loop (THE PRODUCT)
- On-device ASR + word aligner + templates + static Sheikh
- *Exit:* **child FP < 5%**, bad-audio gate > 90%, e2e < 2s  
- **STOP HERE until exit passes**

### Phase 2 — Parent dashboard + curriculum
- Hifz metrics, SM-2, Alifba→Qaida→Surah (Mahfuz-inspired)
- *Exit:* parent sees accurate progress; COPPA posture verified

### Phase 3 — Deeper CAPT (gated)
- Offline FastConformer / Muaalem-class scoring with ≥2/3 consensus
- Phoneme errors only at high confidence; self-trained weights if commercial
- *Exit:* phoneme FP ≤ word FP on child golden set

### Phase 4 — Polish (gated)
- Rive avatar + optional constrained LLM phrasing
- LiveKit **only** if live human tutor rooms are a real feature
- *Exit:* no FP regression; avatar never invents judgment

---

## 7. Top Risks → Mitigations

1. False corrections to kids → Precision-first + silence + ≤1 tip/turn  
2. Phoneme MDD low precision (~0.37) → Word-level v1 only  
3. NPL-1.2 forbids paid features powered by Quran-Lab weights → MIT tiny / self-train / keep free  
4. Child ASR gap → Age tiers; correction OFF under 6  
5. Model “hears the rule” → No fine tajweed auto-score in v1  
6. LiveKit ops → Cut from v1  
7. Avatar authority bias → Defer until ASR proven  
8. Privacy/COPPA → On-device default; no upload without parent opt-in  
9. Content drift → Pinned orthography SSoT  
10. Small team burnout → MVRA only; defer everything else  

---

## 8. Go / No-Go Checklist

- [ ] Child golden benchmark exists and FP-rate measured ≤ SLO  
- [ ] Word-level only shipping; fine tajweed OFF  
- [ ] Consensus + SNR gates enforced in automated tests  
- [ ] LiveKit not in v1 critical path  
- [ ] License: MIT/self-train OR NPL with free-forever feature + disclaimer  
- [ ] Tanzil attribution; audio self-hosted on R2 (no Tarteel CDN hotlink)  
- [ ] Human escalation path designed  
- [ ] Disclaimer on every result screen  
- [ ] Feature flag to disable all auto-correction instantly  

---

## 9. Supersedes

This verdict **updates** earlier recommendations:

| Earlier doc | Change |
|---|---|
| `virtual-kuttab-full-scope-research.md` | LiveKit/Rive demoted from v1 defaults |
| `architecture-validation-review.md` | LiveKit “production approved” → **approved for later duplex/tutor only** |
| Prior Zipformer-as-primary-judge | Demoted; streaming = highlight later; judge = word-level first |

---

## 10. Final Sentence

**The bulletproof product is not the smartest ASR — it is the one that listens with a human qari, corrects only when confident at word level, stays silent when unsure, and brings a human teacher when needed.**
