import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn("Supabase env missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url || "http://localhost", anon || "missing");

export type AyahRow = {
  surah: number;
  ayah: number;
  text_uthmani: string;
};

export type AyahAudioRow = {
  surah: number;
  ayah: number;
  qari: string;
  audio_url: string;
  timings_json: unknown | null;
};
