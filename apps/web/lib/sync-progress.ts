/**
 * Stage 1 — dual-write + merge guest localStorage ↔ Supabase.
 * Guest always keeps working offline; cloud sync when session exists.
 */
import { supabase } from "./supabase";
import {
  loadProgress,
  saveProgressLocal,
  type HifzProgress,
} from "./progress";
import { loadStats, saveStatsLocal, type HifzStats } from "./stats";

function ts(iso: string | null | undefined): number {
  if (!iso) return 0;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchCloudBookmark(): Promise<HifzProgress | null> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("hifz_bookmarks")
    .select("surah,ayah,perfect,bad_count,updated_at")
    .eq("user_id", uid)
    .maybeSingle();
  if (error || !data) return null;
  return {
    surah: data.surah,
    ayah: data.ayah,
    perfect: data.perfect,
    badCount: data.bad_count ?? 0,
    updatedAt: data.updated_at,
  };
}

export async function fetchCloudStats(): Promise<(HifzStats & { updatedAt?: string }) | null> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("hifz_stats")
    .select(
      "streak,last_active_day,today_count,today_day,total_scores,updated_at",
    )
    .eq("user_id", uid)
    .maybeSingle();
  if (error || !data) return null;
  return {
    streak: data.streak ?? 0,
    lastActiveDay: data.last_active_day,
    todayCount: data.today_count ?? 0,
    todayDay: data.today_day,
    totalScores: data.total_scores ?? 0,
    updatedAt: data.updated_at,
  };
}

export async function upsertCloudBookmark(p: HifzProgress): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;
  await supabase.from("hifz_bookmarks").upsert(
    {
      user_id: uid,
      surah: p.surah,
      ayah: p.ayah,
      perfect: p.perfect,
      bad_count: p.badCount,
      updated_at: p.updatedAt || new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function upsertCloudStats(s: HifzStats): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;
  await supabase.from("hifz_stats").upsert(
    {
      user_id: uid,
      streak: s.streak,
      last_active_day: s.lastActiveDay,
      today_count: s.todayCount,
      today_day: s.todayDay,
      total_scores: s.totalScores,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

/** After score / ayah change: local already written; push to cloud if logged in. */
export async function pushProgressIfAuthed(partial: {
  surah: number;
  ayah: number;
  perfect?: boolean | null;
  badCount?: number;
}): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return;
  const local = loadProgress();
  if (!local) return;
  // ensure partial fields reflected
  const next: HifzProgress = {
    surah: partial.surah,
    ayah: partial.ayah,
    perfect: partial.perfect ?? local.perfect,
    badCount: partial.badCount ?? local.badCount,
    updatedAt: local.updatedAt,
  };
  await upsertCloudBookmark(next);
}

export async function pushStatsIfAuthed(): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return;
  await upsertCloudStats(loadStats());
}

/**
 * Merge guest local ↔ cloud on sign-in.
 * Bookmark: newer updatedAt wins, then write both sides.
 * Stats: take max totals / streak heuristics, then write both sides.
 */
export async function mergeGuestProgressOnAuth(): Promise<{
  progress: HifzProgress | null;
  stats: HifzStats;
}> {
  const localP = loadProgress();
  const cloudP = await fetchCloudBookmark();
  let progress: HifzProgress | null = null;

  if (localP && cloudP) {
    progress = ts(localP.updatedAt) >= ts(cloudP.updatedAt) ? localP : cloudP;
  } else {
    progress = localP || cloudP;
  }

  if (progress) {
    saveProgressLocal(progress);
    await upsertCloudBookmark(progress);
  }

  const localS = loadStats();
  const cloudS = await fetchCloudStats();
  let stats: HifzStats = localS;

  if (cloudS) {
    const today = localS.todayDay;
    const sameDay =
      cloudS.todayDay && today && cloudS.todayDay === today;
    stats = {
      streak: Math.max(localS.streak || 0, cloudS.streak || 0),
      lastActiveDay:
        ts(localS.lastActiveDay) >= ts(cloudS.lastActiveDay)
          ? localS.lastActiveDay
          : cloudS.lastActiveDay,
      todayCount: sameDay
        ? Math.max(localS.todayCount || 0, cloudS.todayCount || 0)
        : localS.todayDay &&
            (!cloudS.todayDay || (localS.todayDay > (cloudS.todayDay || "")))
          ? localS.todayCount
          : cloudS.todayDay &&
              (!localS.todayDay || cloudS.todayDay > localS.todayDay)
            ? cloudS.todayCount
            : Math.max(localS.todayCount || 0, cloudS.todayCount || 0),
      todayDay:
        localS.todayDay && cloudS.todayDay
          ? localS.todayDay >= cloudS.todayDay
            ? localS.todayDay
            : cloudS.todayDay
          : localS.todayDay || cloudS.todayDay,
      totalScores: Math.max(localS.totalScores || 0, cloudS.totalScores || 0),
    };
  }

  saveStatsLocal(stats);
  await upsertCloudStats(stats);

  return { progress, stats };
}

/** Effective continue pointer for Home (cloud preferred when newer). */
export async function resolveContinueProgress(): Promise<HifzProgress | null> {
  const local = loadProgress();
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return local;
  const cloud = await fetchCloudBookmark();
  if (!cloud) return local;
  if (!local) return cloud;
  return ts(cloud.updatedAt) >= ts(local.updatedAt) ? cloud : local;
}
