# Virtual Kuttab — Full-Scope Deep Research Report

> **SUPERSEDED FOR v1 DECISIONS:** See [`BULLETPROOF-ARCHITECTURE-VERDICT.md`](./BULLETPROOF-ARCHITECTURE-VERDICT.md)  
> (Principal Architect + Senior Engineer validation, 2026-10-26).  
> Key updates: LiveKit/Rive/LLM deferred; word-level on-device ASR first; precision-first gates.

*Generated: 2026-10-26 | Confidence: High*  
*Research orchestrated with 4 specialist agents (Claude Opus 4.8 thinking-high)*  
*Agents: [Avatar Stack](3da3d700-8c16-4271-9d00-f6695d4a4777) · [Quran OSS/APIs](ede40d83-ad21-4636-96e4-34d93b31833a) · [Full-Stack](ca2933f1-7cea-4559-a3f2-96c907cd51a5) · [Audio/TTS/CAPT](9cf5547b-8d9d-402d-b965-fcf3ebe3499c)*

---

## 1. Product Goal (What We Are Building)

A **web site + mobile app** where a child:

1. Opens a lesson (letter → Qaida → ayah → Hifz review)
2. Listens to a human qari (never TTS for Qur'an text)
3. Recites into the microphone
4. A **Virtual Sheikh avatar** listens, marks wrong/right pronunciation at word/phoneme level
5. Avatar responds with gentle Arabic feedback (voice + lips + gesture)
6. Progress (Hifz metrics) is saved for child + parent dashboard

---

## 2. Recommended Full-Stack Technology (Decision)

### Winner Stack (Startup / OSS-first / cost-effective)

| Layer                 | Technology                                                                                       | Why                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **Monorepo**          | `pnpm` + **Turborepo**                                                                           | Share types/UI between web & mobile                                           |
| **Web / PWA**         | **Next.js 15/16** (App Router) + **Serwist** (PWA)                                               | Kid lesson UI + parent portal + marketing                                     |
| **Mobile**            | **React Native + Expo**                                                                          | Same TS ecosystem, mic/camera permissions, offline; LiveKit RN SDK            |
| **Alt mobile**        | Flutter                                                                                          | Prefer only if animation fidelity > code sharing                              |
| **Realtime audio**    | **LiveKit** (Apache-2.0, self-hostable) + **LiveKit Agents**                                     | Purpose-built for AI voice agents; WebRTC SFU; no Agora lock-in               |
| **Backend API**       | **FastAPI** (Python) for AI; **Next.js Route Handlers / Supabase Edge** for BFF                  | ASR/align/TTS live in Python; CRUD in TS                                      |
| **Data / Auth**       | **Supabase** (Postgres + Auth + RLS + Storage + Realtime)                                        | Parent accounts, child profiles, RLS; ~$25/mo                                 |
| **Avatar (primary)**  | **Rive** (`@rive-app/react-canvas` / `rive-react-native`)                                        | Default for kids mid-range phones: ~small `.riv`, 60fps, Data Messages visemes; runtimes MIT (Editor export may need Cadet ~$9/mo) |
| **Alt avatar**        | three-vrm / TalkingHead (high-end/desktop only)                                                  | Avoid on child lesson path — VRM WebView can hit ~700MB RAM / thermal throttle |
| **ASR / CAPT**        | **sherpa-onnx** + Zipformer/FastConformer Quran models + **quran-muaalem** / `quran-transcript`  | Streaming + tajweed-aware scoring                                             |
| **TTS (Sheikh only)** | **Piper** (`ar_JO-kareem`) MVP → **Habibi-TTS MSA** (Apache-2.0) → Azure viseme TTS fallback     | Never TTS the Qur'an itself                                                   |
| **Qur'an content**    | `@quranjs/api` + Tanzil / QUL offline + EveryAyah / QUA timings                                  | Word-by-word + audio + segments                                               |
| **CDN / objects**     | **Cloudflare R2** + Cloudflare CDN                                                               | Near-zero egress for audio packs                                              |
| **Push**              | Expo Notifications (parents only)                                                                | COPPA-safe                                                                    |
| **Observability**     | OpenTelemetry + Sentry                                                                           | Latency budgets on ASR/LLM                                                    |
| **Hosting launch**    | Vercel/Cloudflare Pages + Supabase + LiveKit Cloud (or Docker self-host) + 1 GPU/CPU box for ASR | **~$90–150/mo** managed                                                       |

### Rejected Alternatives (and why)

| Rejected | Why |
|---|---|
| Capacitor wrapping web-only | Mic + realtime WebRTC reliability weaker for kids apps |
| Kotlin Multiplatform | Smaller ecosystem for LiveKit/avatar tooling |
| Firebase-only | Weaker SQL analytics for Hifz; vendor lock for AI pipeline |
| NestJS as primary AI host | Python wins for ASR/ONNX ecosystem |
| Agora / Twilio Voice | Cost + lock-in; LiveKit is OSS-equivalent |
| Socket.io alone | Not enough for robust A/V; use LiveKit WebRTC |
| MuseTalk / LivePortrait / Wav2Lip as v1 avatar | GPU cost, latency, license traps; uncanny for kids |
| Whisper-large as primary CAPT | Auto-corrects; phone WER collapses; too heavy |
| NPL-1.2 Zipformer in paid product | **Illegal for paid features** — train own or use MIT paths |

---

## 3. System Architecture (End-to-End)

```
┌──────────────── CHILD CLIENT (PWA / Expo) ─────────────────┐
│  Mushaf UI (@quranjs data)  │  Mic → LiveKit room          │
│  Word highlight (timings)   │  Avatar (three-vrm / Rive)   │
│  Lesson / gamification      │  Viseme + gesture playback   │
└───────────────┬─────────────────────────────▲──────────────┘
                │ WebRTC audio                │ audio+visemes+RPC
                ▼                             │
┌──────────── LIVEKIT SFU (self-host or Cloud) ──────────────┐
│  Room: child + VirtualSheikh Agent                          │
└───────────────┬─────────────────────────────────────────────┘
                ▼
┌──────── LIVEKIT AGENT (Python) / FastAPI workers ──────────┐
│  1. WebRTC APM / RNNoise denoise                            │
│  2. Silero VAD                                              │
│  3. sherpa-onnx streaming ASR (Quran phoneme/letter CTC)    │
│  4. Align vs Uthmani reference → ErrorLog JSON              │
│  5. quran-muaalem / tajweed rule engine (optional deep)     │
│  6. Feedback policy (templates 80% + small LLM 20%)         │
│  7. TTS (Piper/Habibi/Azure) + viseme timestamps            │
│  8. Publish audio track + data message {visemes, gesture}   │
└───────────────┬─────────────────────────────────────────────┘
                ▼
┌──────── SUPABASE / POSTGRES ───────────────────────────────┐
│  parents, children, lessons, ayah_attempts, daily_hifz      │
│  RLS: parent owns child rows; never expose raw child audio  │
└─────────────────────────────────────────────────────────────┘
```

**Latency target:** child finishes word → avatar starts speaking correction **≤ 1.5–2.0 s** (template path).

---

## 4. Open-Source Projects Inventory (Must Use)

### 4.1 Qur'an Text & Content

| Project | URL | Role | License |
|---|---|---|---|
| **@quranjs/api** | https://quranjs.com · npm `@quranjs/api` | Official TS SDK for Quran Foundation Content API v4 (verses, WBW, audio) | MIT (SDK) |
| **Quran Foundation API v4** | https://api-docs.quran.foundation | Production text/audio/tafsir; OAuth2 `content` scope | Terms + per-resource |
| **Tanzil** | https://tanzil.net/download | Canonical Uthmani/Imlaei offline text | CC BY 3.0 (verbatim) |
| **QUL (Tarteel)** | https://qul.tarteel.ai/resources | Mushaf layouts, fonts, segmented audio, morphology | Mixed per-resource |
| **quran-json** | https://github.com/risan/quran-json | Static offline JSON MVP | CC BY-SA 4.0 (isolate) |
| **spa5k/tafsir_api** | https://github.com/spa5k/tafsir_api | Tafsir JSON CDN | MIT code |

### 4.2 Audio Reciters & Timings

| Project | URL | Role | License |
|---|---|---|---|
| **EveryAyah** | https://everyayah.com | Verse MP3s + timing ZIPs (incl. muallim styles for kids) | Unstated — legal review |
| **quran-align** | https://github.com/cpfair/quran-align | Word-precise timestamps | CC BY 4.0 |
| **QUA** | https://github.com/Wider-Community/quranic-universal-audio | Word/letter timings; children-repeat style | CC BY 4.0 |
| **AlQuran Cloud CDN** | https://alquran.cloud/cdn | Easy audio CDN prototype | Open API |

### 4.3 Recitation AI / CAPT

| Project | URL | Role | License |
|---|---|---|---|
| **sherpa-onnx** | https://github.com/k2-fsa/sherpa-onnx | Streaming ONNX ASR runtime (server + mobile) | Apache-2.0 |
| **quran-muaalem** | https://github.com/obadx/quran-muaalem | Phoneme + sifat/tajweed attributes + Gradio | **QML 1.0** (conditional commercial) |
| **quran-transcript** | https://github.com/obadx/quran-transcript | Phonetizer + `explain_error` | Check repo |
| **FastConformer-Quran** | https://huggingface.co/Muno459/fastconformer-quran | Strong ASR + mispronunciation head | **NPL-1.1** (no profit) |
| **zipformer_p-arabic-v3** | https://huggingface.co/Quran-Lab/zipformer_p-arabic-v3 | Best streaming phoneme ASR | **NPL-1.2** (no profit) |
| **quran-asr-tiny** | https://huggingface.co/Abdou/quran-asr-tiny | 16M MIT mobile letter ASR | **MIT** |
| **Tilawa** | https://github.com/yazinsai/tilawa | Offline verse tracking; FastConformer engine commercial-safer | Code MIT; Zipformer NPL |
| **Itqan** | https://github.com/IemProg/itqan | Flutter CAPT + mushaf reference app | MIT / Apache models |
| **IqraEval** | https://huggingface.co/IqraEval | Training/eval data for MDD | Open benchmark |
| **Real-Time Tracker** | https://github.com/yayaiu6/Real-Time-Quran-recitation-tracker-System | Fuzzy match word tracker blueprint | MIT |

### 4.4 Tajweed Rule Engines (display / explain)

| Project | URL | Role | License |
|---|---|---|---|
| **ghunna** | https://github.com/mwiederrecht/ghunna | Derive tajweed rules + explanations (TS) | MIT |
| **cpfair/quran-tajweed** | https://github.com/cpfair/quran-tajweed | Precomputed coloring spans | CC BY 4.0 |
| **tajweed-analyzer** | https://github.com/nidzammusthafa/tajweed-analyzer | Client-side annotated HTML | MIT |
| **Quran Tajweed Engine** | https://github.com/TheAbubakrAbu/Quran-Tajweed-Engine | Offline annotations + audio bundle | MIT |
| **Mantoq** | https://github.com/mush42/mantoq | Arabic G2P phonemizer | MIT |

### 4.5 Kids Learning UX References

| Project | URL | Role | License |
|---|---|---|---|
| **Mahfuz** | https://github.com/theilgaz/mahfuz | Full kids companion: Alifba, Qaida stages, games, SM-2 Hifz | MIT |
| **Magical Hijaiyah Cube** | https://github.com/ayitas/magical-hijaiyah-cube | 3D letter games (Three.js) | MIT |

### 4.6 Avatar / Virtual Sheikh

| Project | URL | Role | License |
|---|---|---|---|
| **TalkingHead** | https://github.com/met4citizen/TalkingHead | Full-body 3D talking avatar (three.js) | MIT |
| **three-vrm** | https://github.com/pixiv/three-vrm | VRM/VRoid cartoon avatar | MIT |
| **three-vrm-lip-sync** | https://github.com/vlapky/three-vrm-lip-sync | In-browser MFCC lip sync | MIT |
| **Rhubarb Lip Sync** | https://github.com/DanielSWolf/rhubarb-lip-sync | Offline visemes from audio (language-agnostic phonetic) | MIT-style |
| **OpenAvatarChat** | https://github.com/HumanAIGC-Engineering/OpenAvatarChat | Ready voice-chat + LiteAvatar pipeline | Apache-2.0 |
| **VRoid Studio** | https://vroid.com | Free cute Sheikh character → VRM export | Tool ToS |

**Avatar WINNER for kids:** stylized **VRM cartoon Sheikh** (three-vrm) or **TalkingHead** — **not** MuseTalk/LivePortrait photoreal (GPU + uncanny + license issues).

### 4.7 Realtime / Agents

| Project | URL | Role | License |
|---|---|---|---|
| **LiveKit server** | https://github.com/livekit/livekit | WebRTC SFU | Apache-2.0 |
| **LiveKit Agents** | https://github.com/livekit/agents | Voice AI agent framework (STT/LLM/TTS plugins) | Apache-2.0 |
| **livekit-client / RN SDK** | npm / Expo | Client SDKs | Apache-2.0 |

### 4.8 TTS / Audio Cleanup

| Project | URL | Role | License |
|---|---|---|---|
| **Piper** | https://github.com/rhasspy/piper | Fast CPU TTS; `ar_JO-kareem` | MIT |
| **Habibi-TTS** | https://huggingface.co/SWivid/Habibi-TTS | Arabic dialects; MSA = Apache-2.0 | Mixed (use MSA) |
| **Silero VAD** | via sherpa-onnx | Voice activity | Permissive |
| **RNNoise / DeepFilterNet** | various | Denoise for phone kids | OSS |
| **WebRTC APM** | browser / libwebrtc | AEC / NS on-device | BSD-style |

---

## 5. APIs We Will Use

### Required / Primary

| API | Purpose |
|---|---|
| **Quran Foundation Content API v4** (`@quranjs/api/server`) | Verses, scripts (Uthmani/Imlaei), word-by-word, `word.audioUrl` → `https://audio.qurancdn.com/`, chapter/verse recitation + `segments=true` timings |
| **LiveKit** (Cloud or self-host) | Realtime room tokens, WebRTC media, agent dispatch |
| **Supabase Auth + PostgREST** | Parent login, child profiles, RLS CRUD |
| **Own FastAPI** `/ws` or LiveKit Agent RPCs | ASR partials, ErrorLog, feedback events |

### Optional / Fallback

| API | Purpose |
|---|---|
| **Azure Speech (viseme TTS)** | Streaming Arabic TTS + `animation_viseme.delta` for lips |
| **ElevenLabs / Google / OpenAI TTS** | Backup Sheikh voice (never Qur'an ayah TTS) |
| **AlQuran Cloud** | No-key prototype for text/audio during early MVP |
| **Cloudflare R2** S3 API | Host bundled EveryAyah / lesson audio packs |

### Policy rule (critical)

> **Do not TTS Qur'anic ayah text.** Play **human reciter** MP3s (EveryAyah / Quran.com audio). TTS is only for Sheikh teaching phrases: praise, tip, “أعد كلمة مَالِكِ”.

---

## 6. Exact Libraries / Packages (Install Cheat-Sheet)

### Web

```bash
pnpm add next @quranjs/api three @pixiv/three-vrm three-vrm-lip-sync
pnpm add @met4citizen/talkinghead   # optional full-body
pnpm add livekit-client @livekit/components-react
pnpm add @supabase/supabase-js zod
pnpm add @rive-app/react-canvas     # optional 2D avatar
```

### Mobile (Expo)

```bash
npx create-expo-app
pnpm add @livekit/react-native livekit-client
pnpm add @supabase/supabase-js
pnpm add rive-react-native          # or WebView for three.js avatar
pnpm add @react-native-community/netinfo expo-av expo-secure-store
```

### AI Worker (Python)

```bash
pip install "livekit-agents[silero]" fastapi uvicorn
pip install sherpa-onnx numpy soundfile onnxruntime
pip install quran-muaalem           # if QML terms OK
pip install redis asyncpg pydantic
# Piper binary + ar_JO-kareem.onnx for TTS MVP
```

---

## 7. Feature Modules → Tech Mapping

| Product feature | Tech |
|---|---|
| Mushaf + word highlight | `@quranjs/api` + QUA/`quran-align` segments + CSS tajweed (`ghunna` / `tajweed-analyzer`) |
| Listen to qari | EveryAyah / QF audio CDN |
| Kid recites | LiveKit mic track → Agent |
| Track current word | Tilawa FastConformer **or** fuzzy Levenshtein over streaming ASR |
| Detect wrong pronunciation | CTC phoneme ASR + aligner; deepen with muaalem sifat |
| Virtual Sheikh avatar | three-vrm / TalkingHead + visemes |
| Sheikh speaks | Piper/Habibi prebaked clips + Rhubarb visemes; Azure for dynamic |
| Lessons (Alifba → Qaida → Surah) | Curriculum model inspired by **Mahfuz** |
| Hifz spaced repetition | SM-2 (as in Mahfuz) + `ayah_attempts` table |
| Parent dashboard | Next.js + Supabase RLS |
| Offline mode | Serwist/Expo offline packs: text JSON + selected audio + tiny ASR on-device later |

---

## 8. Licensing Strategy (Do Not Skip)

| Safe for paid product | Conditional | Forbidden in paid feature |
|---|---|---|
| `@quranjs/api`, Tanzil (verbatim), quran-align, QUA, ghunna, Mahfuz, TalkingHead, three-vrm, sherpa-onnx, **quran-asr-tiny**, Tilawa FastConformer path, Piper, Habibi MSA, LiveKit, Itqan | **muaalem (QML)**: free path to core, no ads, AI-disclaimer | **Quran-Lab / Muno459 NPL models**, Wav2Lip NC, XTTS CPML weights in commercial (prototype only), Halabi phonetiser NC |

**Commercial ASR path:** start with `quran-asr-tiny` (MIT) + self-train Zipformer/FastConformer CTC on EveryAyah + child data → own MIT/Apache weights.

---

## 9. COPPA / Child Safety (Architecture Constraints)

1. **Account = parent**; child is a profile, not an email login
2. **Minimize retention** of child voice — score then discard by default
3. Voice may be biometric under some laws — consent UX + opt-in for model improvement
4. No ads on child surfaces (also required by muaalem QML)
5. Push notifications to **parents only**
6. Avatar disclaimer: “مساعد تقني وليس بديلاً عن معلّم مؤهّل”
7. Third-party SDKs: prefer self-host LiveKit/ASR to reduce data processors

---

## 10. Phased Build Roadmap

### Phase 0 — Foundations (2–3 weeks)

- Turborepo: Next.js PWA + Expo shell  
- Supabase schema (parents/children/lessons)  
- `@quranjs/api` mushaf + EveryAyah playback + word highlight

### Phase 1 — Recite loop MVP (3–5 weeks)

- LiveKit room + mic  
- sherpa-onnx / tiny ASR → aligner JSON  
- Template Arabic feedback (no LLM yet)  
- Rive or three-vrm avatar with prebaked Piper lines + Rhubarb visemes

### Phase 2 — Virtual Sheikh intelligence (3–4 weeks)

- muaalem or self-trained phoneme scorer  
- LiveKit Agent orchestration  
- Dynamic TTS + visemes  
- Parent Hifz dashboard

### Phase 3 — Curriculum & polish

- Mahfuz-style Alifba/Qaida games  
- Offline packs  
- Child-voice fine-tune (IqraEval + own consented data)  
- On-device ASR for privacy

---

## 11. One-Page “What We Use” Cheat Card

```
WEB:     Next.js + Serwist PWA + three-vrm/TalkingHead or Rive
MOBILE:  Expo (React Native) + LiveKit RN
VOICE:   LiveKit + LiveKit Agents
AI:      FastAPI + sherpa-onnx + aligner + (muaalem | own CTC)
CONTENT: @quranjs/api + Tanzil/QUL + EveryAyah + quran-align/QUA
TTS:     Piper / Habibi (Sheikh only) · Human qari for Qur'an
DATA:    Supabase Postgres + RLS
CDN:     Cloudflare R2
REF APP: Mahfuz (UX) · Itqan (CAPT) · Tilawa (tracking)
```

---

## 12. Key Takeaways

1. **Full product ≠ ASR alone** — content API, timings, avatar, LiveKit, curriculum, and licenses are equal pillars.
2. **Avatar = WebGL cartoon + visemes**, not GPU talking-head video.
3. **Best open Quran CAPT models are often NPL/QML** — plan commercial weights early.
4. **LiveKit Agents** is the right realtime backbone for a Virtual Sheikh.
5. **Mahfuz + Itqan + Tilawa** are the closest OSS “steal the architecture” references.
6. **Never TTS the Mushaf** — human reciters only.
7. Launch budget **~$90–150/mo** managed; scale by self-hosting LiveKit + ASR.

---

## Sources (selected)

- Quran Foundation / `@quranjs/api` docs — https://api-docs.quran.com  
- LiveKit + Agents — https://github.com/livekit/livekit · https://github.com/livekit/agents  
- TalkingHead / three-vrm / Rhubarb — linked in §4.6  
- Quran-Lab / Muno459 / Abdou / muaalem / IqraEval / Tilawa / Mahfuz / Itqan — linked in §4  
- Prior ASR deep-dive — `docs/virtual-kuttab-architecture-report.md`

## Methodology

Four parallel research agents (Avatar, Quran OSS/APIs, Full-Stack, Audio/TTS/CAPT) plus follow-up web verification on LiveKit and Quran.com API v4. Findings cross-checked for license risk and child-product fit.
