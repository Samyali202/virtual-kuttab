# Husary Muallim 128kbps — verified sources

**PRODUCT LOCK: This is the only Sheikh audio set for Virtual Kuttab.**  
Do not ship Murattal, Mujawwad, or other qaris.

Checked live: 2026-10-26 against https://everyayah.com/data/Husary_Muallim_128kbps/

## Correct files for Virtual Kuttab (listen / repeat)

| What | URL | Size / notes |
|---|---|---|
| **Full set (recommended download)** | `https://everyayah.com/data/Husary_Muallim_128kbps/000_versebyverse.zip` | **~2.0 GB** (2754114993 bytes), ZIP of all ayah MP3s |
| **MD5 checksum list** | `https://everyayah.com/data/Husary_Muallim_128kbps/000_checksum.md5` | ~274 KB — verify after extract |
| **Per-ayah MP3s** | `https://everyayah.com/data/Husary_Muallim_128kbps/SSSAAA.mp3` | **6236** files |
| **Per-surah ZIPs** | `https://everyayah.com/data/Husary_Muallim_128kbps/zips/001.zip` … `114.zip` | Smaller chunks (e.g. 001.zip ~1 MB) |
| **Verified HF mirror** | `https://huggingface.co/datasets/maqra-project/mahmoud-al-husary-muallim-128kbps` | Same 6236 files, checksums |

## Naming

```
SSSAAA.mp3
SSS = surah (001–114)
AAA = ayah  (001–…)

Examples:
  001001.mp3  → Al-Fatihah 1:1   (verified 126986 bytes)
  001007.mp3  → Al-Fatihah 1:7
  114006.mp3  → An-Nas 114:6
```

- **No `001000.mp3`** in this set (HEAD → 404).
- Do **not** use folder `merged/` or `PageMp3s/` for the app’s ayah player (those are special packs).

## What NOT to confuse with

| Set | Path | Use |
|---|---|---|
| Husary **Murattal** | `…/Husary_128kbps/` | Normal continuous style (we already sampled this) |
| Husary **Muallim** | `…/Husary_Muallim_128kbps/` | **Teaching / listen-then-repeat** ← use this |
| Husary Mujawwad | `…/Husary_Mujawwad_*` | Different style |

## App URL template

```text
https://everyayah.com/data/Husary_Muallim_128kbps/{surah:03d}{ayah:03d}.mp3
```

Production: download once → host on **Cloudflare R2** (do not hotlink EveryAyah at scale).

## Local full set (downloaded 2026-10-26)

| Path | Status |
|---|---|
| `content/audio/husary_muallim/000_versebyverse.zip` | **SIZE_OK** 2754114993 bytes |
| `content/audio/husary_muallim/mp3/*.mp3` | **6236** files extracted |
| Spot MD5 | `001001`, `001007`, `114006` → **MD5_OK** |
| Checksums | `content/audio/000_checksum_muallim.md5` |
| Small samples | `content/audio/husary_muallim_sample/` (Fatiha only) |

App path template (local):  
`content/audio/husary_muallim/mp3/{surah:03d}{ayah:03d}.mp3`

Optional: delete the zip after extract to free ~2.56 GB (MP3s already on disk).
