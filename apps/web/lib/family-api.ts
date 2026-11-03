import { supabase } from "./supabase";
import type { ProfileRow } from "./auth-api";
import type { HifzProgress } from "./progress";
import type { HifzStats } from "./stats";

export type KidCard = {
  profile: ProfileRow;
  bookmark: HifzProgress | null;
  stats: HifzStats | null;
};

export async function listMyKids(): Promise<KidCard[]> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return [];

  const { data: links, error } = await supabase
    .from("family_links")
    .select("child_id")
    .eq("parent_id", uid);
  if (error || !links?.length) return [];

  const ids = links.map((l) => l.child_id as string);
  const [{ data: profiles }, { data: bookmarks }, { data: statsRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id,display_name,username,phone_e164,age,role,locale,created_at")
        .in("id", ids),
      supabase
        .from("hifz_bookmarks")
        .select("user_id,surah,ayah,perfect,bad_count,updated_at")
        .in("user_id", ids),
      supabase
        .from("hifz_stats")
        .select(
          "user_id,streak,last_active_day,today_count,today_day,total_scores",
        )
        .in("user_id", ids),
    ]);

  const bmBy = new Map(
    (bookmarks || []).map((b) => [
      b.user_id as string,
      {
        surah: b.surah as number,
        ayah: b.ayah as number,
        perfect: b.perfect as boolean | null,
        badCount: (b.bad_count as number) ?? 0,
        updatedAt: b.updated_at as string,
      } satisfies HifzProgress,
    ]),
  );
  const stBy = new Map(
    (statsRows || []).map((s) => [
      s.user_id as string,
      {
        streak: (s.streak as number) ?? 0,
        lastActiveDay: (s.last_active_day as string) ?? null,
        todayCount: (s.today_count as number) ?? 0,
        todayDay: (s.today_day as string) ?? null,
        totalScores: (s.total_scores as number) ?? 0,
      } satisfies HifzStats,
    ]),
  );

  return (profiles || []).map((p) => ({
    profile: p as ProfileRow,
    bookmark: bmBy.get(p.id) ?? null,
    stats: stBy.get(p.id) ?? null,
  }));
}

export async function createKid(input: {
  displayName: string;
  username: string;
  password: string;
  age?: number | null;
  email?: string;
}): Promise<{ ok: true; child: { id: string; username: string } } | { ok: false; error: string }> {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return { ok: false, error: "unauthorized" };

  const { data, error } = await supabase.functions.invoke("parent-create-kid", {
    body: input,
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error || "create_failed" };
  return { ok: true, child: data.child };
}

export async function resetKidPassword(
  childId: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return { ok: false, error: "unauthorized" };

  const { data, error } = await supabase.functions.invoke(
    "parent-reset-kid-password",
    { body: { childId, password } },
  );
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error || "reset_failed" };
  return { ok: true };
}
