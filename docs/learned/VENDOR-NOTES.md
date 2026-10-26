# Vendor study notes

## hifz-tester (`vendor/hifz-tester`)
- Word-level only; honest about ASR false positives.
- Record-then-review pattern matches our Recite mode.
- Useful for alignment/normalization ideas — do not copy Whisper stack blindly.

## tilawa (`vendor/tilawa`)
- Offline follow-along / verse tracking.
- Code MIT; default Zipformer weights may be NPL — use FastConformer path if commercial.

## quran-align (`vendor/quran-align`)
- Produces word timestamps for karaoke listen mode.
- CC BY 4.0 data — good companion to Husary timings.

## mahfuz (`vendor/mahfuz`)
- Curriculum, games, SM-2 Hifz UX — steal product structure later, not for v1 scoring.

## quran-json (`vendor/quran-json`)
- Convenient static JSON; ShareAlike — prefer Tanzil CC-BY for production SSoT text.

## quran-asr-tiny (`models/quran-asr-tiny`)
- MIT, 16M, int8 ONNX, sherpa-onnx OfflineRecognizer.from_zipformer_ctc.
- No diacritics in output → strip harakat on reference when aligning.
