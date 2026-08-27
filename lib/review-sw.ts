// 週次振り返り通知（月曜 9:00）と日付切り替え処理（background 専用）。
// 「先週の自分」を数字で見せることが振り返り＝自己モニタリングの起点になる。
import { formatDurationJa } from "./format";
import { calcStreak, lastNDateKeys, summarizeRange } from "./stats";
import { updateBadge } from "./stats-sw";
import { getSettings, statsItem } from "./storage";
import { STR } from "./strings";

export const WEEKLY_REVIEW_ALARM = "weekly-review";
export const MIDNIGHT_ALARM = "midnight-refresh";

/** 次の月曜 9:00（すでに過ぎていれば翌週） */
function nextMondayNine(now: Date): number {
  const d = new Date(now);
  d.setHours(9, 0, 0, 0);
  const day = d.getDay(); // 1 = 月曜
  let addDays = (1 - day + 7) % 7;
  if (addDays === 0 && d.getTime() <= now.getTime()) addDays = 7;
  d.setDate(d.getDate() + addDays);
  return d.getTime();
}

function nextMidnight(now: Date): number {
  const d = new Date(now);
  d.setHours(24, 0, 30, 0); // 0:00:30（日付確定後）
  return d.getTime();
}

export function armReviewAlarms(): void {
  const now = new Date();
  chrome.alarms.create(WEEKLY_REVIEW_ALARM, {
    when: nextMondayNine(now),
    periodInMinutes: 7 * 24 * 60,
  });
  chrome.alarms.create(MIDNIGHT_ALARM, {
    when: nextMidnight(now),
    periodInMinutes: 24 * 60,
  });
}

export async function onWeeklyReviewAlarm(): Promise<void> {
  const settings = await getSettings();
  if (!settings.weeklyReview) return;
  const stats = await statsItem.getValue();
  const now = new Date();
  // 昨日までの 7 日間を集計
  const keys = lastNDateKeys(8, now).slice(0, 7);
  const sum = summarizeRange(stats, keys);
  const streak = calcStreak(stats, settings.dailyPomodoroGoal, now);
  const lines = [
    `🍅 ポモドーロ ${sum.pomodoros} 回`,
    `🚫 ブロック ${sum.blocks} 回`,
    `⏱ 一時許可 ${formatDurationJa(sum.allowSec)}`,
    ...(streak >= 2 ? [`🔥 ${streak}日連続で目標達成中`] : []),
  ];
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("/icon/128.png"),
    title: `${STR.appName} — 先週の振り返り`,
    message: lines.join(" / "),
  });
}

/** 日付が変わったらバッジ（今日のブロック数）をリセット表示にする */
export async function onMidnightAlarm(): Promise<void> {
  await updateBadge();
}
