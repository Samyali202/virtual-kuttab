/** Local streak + daily goal (no auth). */

export type HifzStats = {
  streak: number;
  lastActiveDay: string | null;
  todayCount: number;
  todayDay: string | null;
  totalScores: number;
};

const KEY = "vk_hifz_stats";
export const DAILY_GOAL = 5;

function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayKey(d = new Date()): string {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return todayKey(y);
}

const EMPTY: HifzStats = {
  streak: 0,
  lastActiveDay: null,
  todayCount: 0,
  todayDay: null,
  totalScores: 0,
};

export function loadStats(): HifzStats {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const s = JSON.parse(raw) as HifzStats;
    const today = todayKey();
    if (s.todayDay !== today) {
      return { ...s, todayCount: 0, todayDay: today };
    }
    return s;
  } catch {
    return { ...EMPTY };
  }
}

/** Call after each scored recite (perfect or with mistakes). */
export function recordScoreAttempt(): HifzStats {
  if (typeof window === "undefined") return loadStats();
  const today = todayKey();
  const prev = loadStats();
  let streak = prev.streak || 0;

  if (prev.lastActiveDay === today) {
    streak = Math.max(1, streak);
  } else if (prev.lastActiveDay === yesterdayKey()) {
    streak += 1;
  } else {
    streak = 1;
  }

  const todayCount = prev.todayDay === today ? (prev.todayCount || 0) + 1 : 1;
  const next: HifzStats = {
    streak,
    lastActiveDay: today,
    todayCount,
    todayDay: today,
    totalScores: (prev.totalScores || 0) + 1,
  };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
