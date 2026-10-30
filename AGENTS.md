# Agent instructions — Virtual Kuttab

Before coding, load project skills under `.cursor/skills/`:

1. `virtual-kuttab` — product laws  
2. `vk-asr-scoring` — ASR service  
3. `vk-content-audio` — Husary/text/timings  
4. `vk-listen-recite-ui` — web UI  

Follow `docs/PRODUCT-DECISION-TARTEEL-STYLE-HIFZ.md` as the source of truth.

**v1 scope:** Listen → Repeat → Recite → word mistakes / أحسنت. No tajweed auto-score.

**Listen karaoke timings (SSoT):** `cpfair/quran-align` Husary Muallim JSON — import with `scripts/import_cpfair_muallim_timings.py`. Do **not** invent Listen timings via energy VAD or ASR-tiny. ASR is for **Recite scoring only**. See `content/timings/ATTRIBUTION.md`.

**Dev ASR host:** Hetzner Cloud **CX23** @ **Nuremberg (`nbg1`)** — `vk-asr` / `2.31.89.146` (~€6/mo). Keep running (pay monthly); do not delete unless asked. See `.cursor/rules/hetzner-dev-hosting.mdc`.
