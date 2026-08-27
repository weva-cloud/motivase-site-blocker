// 統計の書き込み（background 専用）。
// 複数コンテキストからの同時更新で取りこぼさないよう、SW 内で直列化する。
import {
  addAllowSec,
  addBlockHit,
  addPomodoro,
  dateKey,
  getDayStats,
  pruneStats,
} from "./stats";
import { allowLogItem, statsItem } from "./storage";
import type { AllowLogEntry, Stats } from "./types";
import { MAX_ALLOW_LOG_ENTRIES } from "./types";

/** 統計の保持日数（ヒートマップ 15 週 + 余裕） */
const KEEP_DAYS = 400;

let chain: Promise<void> = Promise.resolve();

function enqueue(fn: () => Promise<void>): Promise<void> {
  chain = chain.then(fn, fn);
  return chain;
}

async function mutate(fn: (stats: Stats, todayKey: string) => Stats): Promise<void> {
  const today = new Date();
  const stats = await statsItem.getValue();
  const next = pruneStats(fn(stats, dateKey(today)), KEEP_DAYS, today);
  await statsItem.setValue(next);
  await updateBadge(next);
}

export function recordBlockHit(domain: string): Promise<void> {
  return enqueue(() => mutate((stats, key) => addBlockHit(stats, key, domain)));
}

export function recordPomodoro(): Promise<void> {
  return enqueue(() => mutate((stats, key) => addPomodoro(stats, key)));
}

/** sec は負値も可（早期再ブロック時の払い戻し） */
export function recordAllowUsage(
  domain: string,
  sec: number,
  reason?: string,
): Promise<void> {
  return enqueue(async () => {
    await mutate((stats, key) => addAllowSec(stats, key, domain, sec));
    if (sec > 0) {
      const entry: AllowLogEntry = {
        at: Date.now(),
        domain,
        durationSec: Math.round(sec),
        ...(reason !== undefined && reason.trim() !== ""
          ? { reason: reason.trim().slice(0, 200) }
          : {}),
      };
      const log = await allowLogItem.getValue();
      await allowLogItem.setValue([entry, ...log].slice(0, MAX_ALLOW_LOG_ENTRIES));
    }
  });
}

/** ツールバーバッジに今日のブロック回数を表示する */
export async function updateBadge(stats?: Stats): Promise<void> {
  const s = stats ?? (await statsItem.getValue());
  const blocks = getDayStats(s, dateKey(new Date())).blocks;
  await chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
  await chrome.action.setBadgeTextColor({ color: "#1c1917" });
  await chrome.action.setBadgeText({ text: blocks > 0 ? String(blocks) : "" });
}

/** 今日このドメインで一時許可に使った秒数 */
export async function allowSecUsedToday(domain: string): Promise<number> {
  const stats = await statsItem.getValue();
  return getDayStats(stats, dateKey(new Date())).allowSecByDomain[domain] ?? 0;
}
