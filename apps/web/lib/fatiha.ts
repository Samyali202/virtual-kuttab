/** Local fallback so Listen/Recite works without waiting on Supabase. */
export const FATIHA = [
  { surah: 1, ayah: 1, text_uthmani: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" },
  { surah: 1, ayah: 2, text_uthmani: "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ" },
  { surah: 1, ayah: 3, text_uthmani: "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" },
  { surah: 1, ayah: 4, text_uthmani: "مَٰلِكِ يَوْمِ ٱلدِّينِ" },
  { surah: 1, ayah: 5, text_uthmani: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ" },
  { surah: 1, ayah: 6, text_uthmani: "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ" },
  {
    surah: 1,
    ayah: 7,
    text_uthmani:
      "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ",
  },
] as const;

export function muallimUrl(ayah: number, r2Base?: string) {
  const file = `001${String(ayah).padStart(3, "0")}.mp3`;
  if (r2Base) return `${r2Base.replace(/\/$/, "")}/${file}`;
  return `/demo/muallim/${file}`;
}
