---
license: mit
language:
- ar
pipeline_tag: automatic-speech-recognition
library_name: sherpa-onnx
tags:
- quran
- quranic-recitation
- arabic
- speech-recognition
- ctc
- conformer
- onnx
- sherpa-onnx
- on-device
- tiny
datasets:
- tarteel-ai/tlog
- IqraEval/Iqra_train
- Quran-Lab/quranic-asr-benchmark
model-index:
- name: quran-asr-tiny
  results:
  - task:
      type: automatic-speech-recognition
      name: Quranic recitation recognition
    dataset:
      name: Quran-Lab Quranic ASR Benchmark (600 held-out clips)
      type: Quran-Lab/quranic-asr-benchmark
    metrics:
    - type: wer
      value: 6.94
      name: WER (overall)
    - type: cer
      value: 2.81
      name: CER (overall)
    - type: wer
      value: 17.95
      name: WER (phone recordings, tlog_holdout)
    - type: cer
      value: 5.69
      name: CER (phone recordings, tlog_holdout)
---

# quran-asr-tiny

A **16M-parameter** speech recognizer for **Quran recitation**, small enough to run fully offline
on a phone (**19 MB** int8 ONNX, [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)). It writes
the Arabic letters of what is recited (no diacritics) and handles professional reciters, ordinary
people reciting into a phone, Hafs and Warsh, and anything from slow tartil to fast hadr.

- **6.94% WER / 2.81% CER** on the [Quran-Lab held-out benchmark](https://huggingface.co/datasets/Quran-Lab/quranic-asr-benchmark): **#6 of 33 by WER and #3 by CER** on the [leaderboard](https://huggingface.co/spaces/Quran-Lab/quranic-asr-leaderboard) at submission time; read the [notes](#read-this-before-comparing) before comparing.
- Better than NVIDIA's Arabic FastConformer (115M, 7.44% / 3.08%) and Whisper large-v3 (1.5B, 10.10% / 4.26%), at **1/7 and 1/90 of their size**.
- Transcribes the whole 600-clip benchmark (2.1 h of audio) in **31 s on 4 CPU threads** (int8).
- Trained from scratch on one laptop GPU. All training code is in [`code/`](code).

**Error vs model size**: open models on the Quran-Lab benchmark (lower-left is better)

![Error vs model size](assets/size_vs_error.png)

**Leaderboard**: top 12 by overall word error rate, %

![Leaderboard](assets/leaderboard_wer.png)

## Results

### Quran-Lab benchmark (official `score.py`, 600 clips)

WER / CER in %, lower is better. *Phone* = `tlog_holdout` (real users reciting into the Tarteel app),
*EveryAyah* = studio reciters, *QUL* = reciter al-Nufais.

| Model | Params | Overall | Phone | EveryAyah | QUL |
|---|---:|---|---|---|---|
| zipformer_p-arabic-v3 (streaming, retrieval), #1 | 66M | 3.46 / 1.84 | 7.56 / 1.79 | 0.00 / 0.00 | 4.40 / 3.77 |
| fastconformer-quran (offline 4h) | 115M | 5.41 / 2.96 | 8.88 / 2.66 | 0.93 / 0.26 | 7.78 / 5.91 |
| **quran-asr-tiny (this model, PyTorch fp32)** | **16M** | **6.94 / 2.81** | 17.95 / 5.69 | 1.83 / 0.53 | 5.23 / 3.39 |
| **quran-asr-tiny (int8 ONNX, as shipped)** | **16M** | **7.08 / 2.86** | 18.34 / 5.81 | 1.83 / 0.53 | 5.35 / 3.44 |
| NVIDIA stt_ar_fastconformer | 115M | 7.44 / 3.08 | 16.77 / 5.61 | 1.50 / 0.49 | 7.61 / 4.20 |
| Tarteel (official app, realtime) | – | 9.56 / 5.82 | 16.17 / 7.41 | 5.97 / 3.80 | 9.05 / 6.91 |
| Whisper large-v3 | 1.5B | 10.10 / 4.26 | 26.23 / 12.39 | 5.48 / 1.79 | 4.69 / 1.83 |

Other rows are from the leaderboard's `results.json`. Predictions for every clip are in
[`results/`](results).

**Character error rate by source**

![Character error by source](assets/per_source_cer.png)

### Read this before comparing

1. **Spelling.** The model writes Uthmani rasm (it is trained on the Uthmani text: السموت, الكتب,
   ءامنوا). The benchmark's EveryAyah and QUL references are in standard spelling, so for the
   numbers above each output word that exactly matches a Quran word is rewritten in standard
   spelling using [`spelling.json`](spelling.json), a fixed table built from two editions of the
   Quran text. It never changes a word the model got wrong, only how a correct word is spelled.
   The same table is applied to all three sources, although the tlog references are in Uthmani
   spelling (it costs about 6 WER points there). Raw Uthmani output scores 12.90 / 4.25 overall and
   11.51 / 4.12 on the phone recordings.
2. **Overlap with our training data.** The benchmark is held out from its authors' training data, not ours.
   134 of the 200 EveryAyah clips are Sahl Yassin and Akram AlAlaqimy, two reciters in our training set.
   13 of the 200 phone recordings were in our training data until step ~152k (excluded after that).
   **Without the 134 EveryAyah clips: 8.87% WER / 3.63% CER** (EveryAyah, unseen reciter only: 3.67 / 1.06).
3. Greedy CTC decoding, no language model, no lexicon constraint, no target-ayah hints; the model never sees a reference.

### Reciters never seen in training

Our own test set: 1,000 clips sampled from two Hafs reciters left out of training, plus
6 held-out surahs (1, 18, 36, 55, 67, 112) of the three Warsh reciters. Uthmani letters, so no
spelling conversion is involved.

| Test set | CER | WER |
|---|---:|---:|
| Hani ar-Rifai (Hafs, unseen) | 0.63% | 1.69% |
| Muhammad Siddiq al-Minshawi, 32 kbps (Hafs, unseen) | 2.86% | 5.31% |
| Warsh: Ibrahim al-Dosary (held-out surahs) | 0.28% | 1.20% |
| Warsh: Yassin al-Jazaery (held-out surahs) | 0.28% | 1.20% |
| Warsh: Abdul Basit (held-out surahs) | 7.30% | 11.79% |
| **All** | **1.68%** | **3.37%** |

### Training progress

**Benchmark by checkpoint**: overall WER (standard spelling) and phone-recording CER (raw Uthmani output)

![Benchmark by checkpoint](assets/checkpoints.png)

Points up to 222k are averages of the last 6 checkpoints; 245k is the released checkpoint (lowest validation error).
Adding more phone recordings, not more steps, is what moved the phone numbers.

**Validation character error rate during training** (log scale; the jump at 30k is where ordinary readers (Iqra'Eval) joined the validation set, 1,255 → 1,913 clips)

![Validation character error](assets/training_curve.png)

## Usage

### Python (sherpa-onnx)

```bash
pip install sherpa-onnx soundfile numpy scipy huggingface_hub
huggingface-cli download Abdou/quran-asr-tiny --local-dir quran-asr-tiny --exclude "code/*" "model.pt"
python quran-asr-tiny/transcribe.py recitation.wav               # Uthmani letters
python quran-asr-tiny/transcribe.py recitation.wav --standard    # standard spelling
```

Or directly:

```python
import sherpa_onnx, soundfile as sf

rec = sherpa_onnx.OfflineRecognizer.from_zipformer_ctc(
    model="model.int8.onnx", tokens="tokens.txt", num_threads=2)
wave, sr = sf.read("recitation_16k_mono.wav", dtype="float32")   # 16 kHz mono
s = rec.create_stream()
s.accept_waveform(sr, wave)
rec.decode_stream(s)
print(s.result.text)   # e.g. "قل هو الله احد"
```

### Android / iOS

The ONNX file follows sherpa-onnx's **zipformer CTC** interface (input `x` [N, T, 80] fbank and
`x_lens`; output `log_probs`, `log_probs_len`; metadata `vocab_size` = 31, `subsampling_factor` = 4),
so it loads with the stock sherpa-onnx mobile libraries:
`OfflineModelConfig(zipformerCtc = OfflineZipformerCtcModelConfig(model = "model.int8.onnx"), tokens = "tokens.txt")`.
Feature extraction (80-dim log-mel fbank, 25 ms / 10 ms, 16 kHz) is done by sherpa-onnx itself.

### PyTorch

`model.pt` holds the weights and `model_config`; the model class is `code/quran_asr/model.py`
(`build(config, vocab_size=31)`), the features `code/quran_asr/features.py`.

## Model

| | |
|---|---|
| Architecture | Conformer encoder + CTC: conv subsampling ×4 (2 stride-2 convs, 256 ch), 6 blocks, d=320, 5 heads (RoPE), FF ×4, conv kernel 31, BatchNorm |
| Parameters | 16.4M (int8 ONNX 19 MB, fp32 66 MB) |
| Input | 16 kHz mono, 80-dim log-mel fbank (Kaldi-compatible) |
| Output | 29 Arabic letters + word separator (31 tokens with blank); no diacritics; ة→ه, ى→ي, hamza seats folded |
| Spelling | Uthmani rasm (Hafs text from Tanzil); `spelling.json` converts to standard spelling |
| Decoding | greedy CTC |
| Riwayat | Hafs ʿan ʿAsim, Warsh ʿan Nafiʿ |

## Training data

| Source | Clips | Hours | What | License / terms |
|---|---:|---:|---|---|
| [EveryAyah](https://everyayah.com), Hafs | 231,455 | 1,184 | 38 professional reciters, per-ayah MP3s (murattal, mujawwad, muallim) | everyayah.com terms |
| [EveryAyah](https://everyayah.com), Warsh | 17,648 | 96 | 3 Warsh reciters (labels aligned from the Warsh Uthmani text) | everyayah.com terms |
| [tarteel-ai/tlog](https://huggingface.co/datasets/tarteel-ai/tlog) | 39,893 | 98 | ordinary people reciting into a phone; 73 of 411 shards, labels checked against the audio (40% of clips dropped as mislabelled; 14% of the kept ones relabelled to a neighbouring ayah or with basmala/isti'adha added) | CC-BY-4.0 |
| [IqraEval/Iqra_train](https://huggingface.co/datasets/IqraEval/Iqra_train) | 15,422 | 21 | ordinary readers; only sentences matched to the Quran | not stated |

Labels: the Hafs Uthmani text from [Tanzil](https://tanzil.net) (via [fawazahmed0/quran-api](https://github.com/fawazahmed0/quran-api)), letters only.
Validation: 0.5% of each source. Test: Hani ar-Rifai, al-Minshawi (32 kbps), and 6 Warsh surahs, never trained on.

## Training

- 246,933 steps (19 epochs over a growing dataset), batches of 420 s of audio, AdamW (lr 4e-4, weight decay 1e-3), 500-step warmup, cosine decay to 2%, bf16, grad clip 5. About 24,000 hours of audio seen, ~1.5 days on one laptop GPU (RTX 5070 Ti Laptop, 12 GB).
- Ordinary people (tlog + Iqra'Eval) are sampled to 25% of each epoch's audio; Warsh weighted ×4.
- Augmentation (from step 3,000): speed 0.9/1.0/1.1, tempo stretch ×0.75 to ×2.5 (WSOLA, for slow tartil to fast hadr), gain, noise (SNR 5 to 35 dB), reverb, low-pass (phone bandwidth), SpecAugment.
- What mattered: a shallow model (16-layer and wider ones collapsed to blank output), clean audio for the first steps, fixing everyayah's Warsh ayah numbering and phase-inverted stereo files, and checking tlog labels against the audio.

## Limitations

- Letters only: no harakat, so it cannot judge tajweed or vowelling mistakes.
- Recitation only. Other speech is forced into Quranic-looking letters.
- Phone recordings are still the hardest case (5.7% CER vs 0.5% on studio audio); children and very noisy rooms are underrepresented.
- Riwayat other than Hafs and Warsh were not trained.

## Reproduce

[`code/`](code) holds the whole pipeline (download → prepare → train → export → evaluate), with its own README:

```bash
cd code && pip install -r requirements.txt
python download.py --config config/full.yaml   # everyayah + Iqra'Eval + tlog (needs `hf auth login`, tlog terms accepted)
python prepare.py  --config config/full.yaml   # labels, numbering checks, tlog label checks, manifests
python train.py    --config config/full.yaml   # resumable; dashboard: python dashboard.py
python export.py   --config config/full.yaml --best
python benchmark.py --config config/full.yaml --average 1   # Quran-Lab benchmark (gated)
```

## Files

| File | |
|---|---|
| `model.int8.onnx` | int8 model for sherpa-onnx (what a phone app should ship) |
| `model.onnx` | fp32 ONNX |
| `model.pt` | PyTorch weights + config (step 245,000) |
| `tokens.txt` | sherpa-onnx tokens |
| `spelling.json` | Uthmani → standard spelling table (2,111 words) |
| `transcribe.py` | example script |
| `results/` | benchmark predictions (fp32 and int8), held-out reciter scores, training log |
| `code/` | training and evaluation code |

## Acknowledgements

EveryAyah and the reciters; Tarteel for [tlog](https://huggingface.co/datasets/tarteel-ai/tlog) (CC-BY-4.0);
the [Iqra'Eval](https://huggingface.co/IqraEval) organizers; Quran-Lab for the
[benchmark](https://huggingface.co/datasets/Quran-Lab/quranic-asr-benchmark) and
[leaderboard](https://huggingface.co/spaces/Quran-Lab/quranic-asr-leaderboard); Tanzil for the text; and the
[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) project.

## License

MIT (code and weights). The training data keeps its own terms (see the table above).
