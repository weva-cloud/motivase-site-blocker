// 統計の集計・ストリーク計算（純粋関数）。
// 進捗の可視化（自己モニタリング）とストリーク（連続達成の損失回避）は
// 行動継続の代表的な心理的支えになる。
import type { DayStats, Stats } from "./types";
import { EMPTY_DAY_STATS } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** ローカル日付キー "YYYY-MM-DD" */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getDayStats(stats: Stats, key: string): DayStats {
  return stats.days[key] ?? structuredClone(EMPTY_DAY_STATS);
}

function withDay(stats: Stats, key: string, fn: (d: DayStats) => void): Stats {
  const day = getDayStats(stats, key);
  fn(day);
  return { days: { ...stats.days, [key]: day } };
}

export function addBlockHit(stats: Stats, key: string, domain: string): Stats {
  return withDay(stats, key, (d) => {
    d.blocks += 1;
    d.blocksByDomain[domain] = (d.blocksByDomain[domain] ?? 0) + 1;
  });
}

/** sec は負値も可（早期再ブロック時の払い戻し） */
export function addAllowSec(
  stats: Stats,
  key: string,
  domain: string,
  sec: number,
): Stats {
  return withDay(stats, key, (d) => {
    d.allowSec = Math.max(0, d.allowSec + sec);
    d.allowSecByDomain[domain] = Math.max(0, (d.allowSecByDomain[domain] ?? 0) + sec);
  });
}

export function addPomodoro(stats: Stats, key: string): Stats {
  return withDay(stats, key, (d) => {
    d.pomodoros += 1;
  });
}

/**
 * 連続達成日数。今日が目標達成済みなら今日を含めて、
 * 未達成でも昨日まで続いていればその継続として数える（今日はまだ挽回できる）。
 */
export function calcStreak(stats: Stats, dailyGoal: number, today: Date): number {
  const meets = (d: Date) => getDayStats(stats, dateKey(d)).pomodoros >= dailyGoal;
  let streak = 0;
  let cursor = new Date(today);
  if (!meets(cursor)) {
    cursor = new Date(cursor.getTime() - DAY_MS); // 今日未達なら昨日から遡る
  }
  while (meets(cursor)) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

/** 直近 n 日（today 含む）の日付キー列（古い順） */
export function lastNDateKeys(n: number, today: Date): string[] {
  return Array.from({ length: n }, (_, i) =>
    dateKey(new Date(today.getTime() - (n - 1 - i) * DAY_MS)),
  );
}

export interface RangeSummary {
  blocks: number;
  allowSec: number;
  pomodoros: number;
}

export function summarizeRange(stats: Stats, keys: string[]): RangeSummary {
  const sum: RangeSummary = { blocks: 0, allowSec: 0, pomodoros: 0 };
  for (const key of keys) {
    const d = getDayStats(stats, key);
    sum.blocks += d.blocks;
    sum.allowSec += d.allowSec;
    sum.pomodoros += d.pomodoros;
  }
  return sum;
}

/** 直近 n 日でブロック回数の多いドメイン上位 */
export function topBlockedDomains(
  stats: Stats,
  days: number,
  today: Date,
  limit = 5,
): [string, number][] {
  const counts: Record<string, number> = {};
  for (const key of lastNDateKeys(days, today)) {
    const d = getDayStats(stats, key);
    for (const [domain, n] of Object.entries(d.blocksByDomain)) {
      counts[domain] = (counts[domain] ?? 0) + n;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/** 古い日付のエントリを間引く（保持日数を超えたぶんを削除） */
export function pruneStats(stats: Stats, keepDays: number, today: Date): Stats {
  const keep = new Set(lastNDateKeys(keepDays, today));
  const days: Record<string, DayStats> = {};
  for (const [key, value] of Object.entries(stats.days)) {
    if (keep.has(key)) days[key] = value;
  }
  return { days };
}
