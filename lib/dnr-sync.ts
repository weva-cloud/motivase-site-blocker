// storage の設定 → DNR 動的ルールへの同期（background 専用）。
// 「いま効いているルール」（スケジュール・フォーカスモードを加味）だけを DNR に置く。
// DNR 動的ルールの書き込みはこのモジュール経由のみとし、多重実行は直列化する。
import { activeRules } from "./active";
import { computeDiff, type DnrRule, ruleToDnr } from "./dnr";
import { nextScheduleBoundary } from "./schedule";
import { getSettings, pomodoroItem } from "./storage";
import { sweepBlockedTabs } from "./tabs-sw";

const BOUNDARY_ALARM = "schedule-boundary";

let chain: Promise<void> = Promise.resolve();

/** 設定とあるべき DNR 動的ルールを突き合わせて差分適用する（直列化済み） */
export function syncDynamicRules(): Promise<void> {
  const run = () => doSync();
  chain = chain.then(run, run);
  return chain;
}

async function doSync(): Promise<void> {
  try {
    const [settings, pomodoro] = await Promise.all([
      getSettings(),
      pomodoroItem.getValue(),
    ]);
    const blockedBase = chrome.runtime.getURL("/blocked.html");
    const desired = activeRules(settings, pomodoro, Date.now()).map((r) =>
      ruleToDnr(r, blockedBase),
    );
    const current =
      (await chrome.declarativeNetRequest.getDynamicRules()) as unknown as DnrRule[];
    const { removeRuleIds, addRules } = computeDiff(current, desired);
    if (removeRuleIds.length > 0 || addRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules: addRules as unknown as chrome.declarativeNetRequest.Rule[],
      });
    }
    await armScheduleBoundaryAlarm();
    // DNR は新規リクエストにしか効かない。ルールを追加・有効化した瞬間や
    // スケジュール開始時に、すでに開いているタブもブロック画面へ送り返す。
    await sweepBlockedTabs();
  } catch (e) {
    console.error("[motivase-site-blocker] DNR 同期に失敗しました", e);
  }
}

/**
 * スケジュール型ルールがあるとき、次の有効/無効の切り替わり時刻に
 * alarm を仕掛けて再同期させる。
 */
async function armScheduleBoundaryAlarm(): Promise<void> {
  const settings = await getSettings();
  const hasScheduledRule = settings.rules.some(
    (r) => r.enabled && r.timing === "schedule",
  );
  if (!hasScheduledRule) {
    await chrome.alarms.clear(BOUNDARY_ALARM);
    return;
  }
  const next = nextScheduleBoundary(settings.schedule, new Date());
  if (next === null) {
    await chrome.alarms.clear(BOUNDARY_ALARM);
    return;
  }
  chrome.alarms.create(BOUNDARY_ALARM, { when: next + 1000 });
}

export function isScheduleBoundaryAlarm(name: string): boolean {
  return name === BOUNDARY_ALARM;
}
