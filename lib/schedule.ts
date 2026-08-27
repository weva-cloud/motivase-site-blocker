// ブロックスケジュールの判定（純粋関数）。
// startMin > endMin のときは日を跨ぐ（例: 22:00〜02:00 → 22時以降 or 前日フラグが立つ日の 2時まで）
import type { Schedule } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** now 時点でスケジュールが有効か */
export function isScheduleActive(s: Schedule, now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();
  if (s.startMin === s.endMin) return false; // 幅ゼロは無効扱い
  if (s.startMin < s.endMin) {
    return s.days[day] === true && minutes >= s.startMin && minutes < s.endMin;
  }
  // 日跨ぎ: 当日夜 or 前日開始ぶんの早朝
  const prevDay = (day + 6) % 7;
  return (
    (s.days[day] === true && minutes >= s.startMin) ||
    (s.days[prevDay] === true && minutes < s.endMin)
  );
}

function atMinutes(base: Date, minutes: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

/**
 * 次にスケジュールの有効/無効が切り替わる時刻（epoch ms）。
 * 有効な曜日がなければ null。
 */
export function nextScheduleBoundary(s: Schedule, now: Date): number | null {
  if (s.days.every((d) => d !== true)) return null;
  if (s.startMin === s.endMin) return null;

  const candidates: number[] = [];
  for (let offset = 0; offset <= 7; offset++) {
    const base = new Date(now.getTime() + offset * DAY_MS);
    if (s.days[base.getDay()] !== true) continue;
    const start = atMinutes(base, s.startMin).getTime();
    // 日跨ぎのときの終了はその翌日
    const end =
      s.startMin < s.endMin
        ? atMinutes(base, s.endMin).getTime()
        : atMinutes(base, s.endMin).getTime() + DAY_MS;
    if (start > now.getTime()) candidates.push(start);
    if (end > now.getTime()) candidates.push(end);
  }
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

/** "9:00" のような表示用文字列 */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export const DAY_LABELS_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** スケジュールの日本語説明（例: 「月〜金 9:00〜18:00」） */
export function describeSchedule(s: Schedule): string {
  const activeDays = DAY_LABELS_JA.filter((_, i) => s.days[i] === true);
  if (activeDays.length === 0) return "曜日が選択されていません";
  const daysText = activeDays.length === 7 ? "毎日" : `${activeDays.join("・")}曜`;
  const wrap = s.startMin > s.endMin ? "（翌日）" : "";
  return `${daysText} ${formatMinutes(s.startMin)}〜${formatMinutes(s.endMin)}${wrap}`;
}
