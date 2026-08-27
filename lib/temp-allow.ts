// 一時許可の寿命管理（background 専用）。
// - DNR session ルール（allow, priority 100）でブロックを一時的に上書きする
// - 失効管理は chrome.alarms（30 秒未満は SW 内 setTimeout を併用。
//   メッセージ受信で SW は 30 秒以上生存するため確実に発火し、alarm は
//   30 秒にクランプされたバックストップとして残る）
// - storage.session と session ルールは同寿命（ブラウザ終了で両方消える）
// - フォーカスロック中は拒否、日次予算超過も拒否（コミットメントデバイス）
import { isFocusLock } from "./active";
import { allowRuleFor } from "./dnr";
import { formatDurationJa } from "./format";
import { allowSecUsedToday, recordAllowUsage } from "./stats-sw";
import {
  getSettings,
  nextAllowRuleIdItem,
  pomodoroItem,
  tempAllowsItem,
} from "./storage";
import { sweepBlockedTabs } from "./tabs-sw";

const ALARM_PREFIX = "temp-allow:";

export function tempAllowAlarmName(domain: string): string {
  return `${ALARM_PREFIX}${domain}`;
}

export function domainFromAlarmName(name: string): string | null {
  return name.startsWith(ALARM_PREFIX) ? name.slice(ALARM_PREFIX.length) : null;
}

/**
 * domain を durationSec 秒だけ許可する（既存の許可があれば延長）。
 * ガードに引っかかった場合は日本語メッセージの Error を投げる。
 */
export async function grantTempAllow(
  domain: string,
  durationSec: number,
  reason?: string,
): Promise<void> {
  const now = Date.now();
  const [settings, pomodoro] = await Promise.all([
    getSettings(),
    pomodoroItem.getValue(),
  ]);

  // フォーカスロック: 作業ポモドーロ中は一時許可そのものを禁止
  if (isFocusLock(settings, pomodoro)) {
    throw new Error(
      "フォーカスモード中は一時許可できません。ポモドーロを終えるか停止してください",
    );
  }

  const allows = await tempAllowsItem.getValue();
  const existing = allows[domain];
  const expiresAt = Math.max(existing?.expiresAt ?? 0, now + durationSec * 1000);
  // 実際に増える許可時間（延長時は差分だけ予算を消費する）
  const deltaSec = Math.round(
    (expiresAt - Math.max(existing?.expiresAt ?? now, now)) / 1000,
  );

  // 日次予算チェック
  if (settings.tempAllowBudgetMin !== null && deltaSec > 0) {
    const budgetSec = settings.tempAllowBudgetMin * 60;
    const usedSec = await allowSecUsedToday(domain);
    if (usedSec + deltaSec > budgetSec) {
      const remaining = Math.max(0, budgetSec - usedSec);
      throw new Error(
        remaining === 0
          ? `今日の ${domain} の許可時間（${settings.tempAllowBudgetMin}分）を使い切りました。また明日。`
          : `今日の残り許可時間は ${formatDurationJa(remaining)} です（1日 ${settings.tempAllowBudgetMin}分まで）`,
      );
    }
  }

  let ruleId = existing?.ruleId;
  if (ruleId === undefined) {
    ruleId = await nextAllowRuleIdItem.getValue();
    await nextAllowRuleIdItem.setValue(ruleId + 1);
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [
        allowRuleFor(ruleId, domain) as unknown as chrome.declarativeNetRequest.Rule,
      ],
    });
  }

  await tempAllowsItem.setValue({ ...allows, [domain]: { ruleId, expiresAt } });
  chrome.alarms.create(tempAllowAlarmName(domain), { when: expiresAt });
  scheduleShortExpiry(domain, expiresAt - now);

  if (deltaSec > 0) {
    await recordAllowUsage(domain, deltaSec, reason);
  }
}

/** 30 秒未満の失効は setTimeout で正確に発火させる */
function scheduleShortExpiry(domain: string, msLeft: number): void {
  if (msLeft < 30_000) {
    setTimeout(() => {
      void expireTempAllow(domain);
    }, msLeft);
  }
}

/**
 * 一時許可を失効させる。
 * force=false のときは（延長されていた場合に備えて）期限を再確認する。
 * force=true（ユーザーの「今すぐ再ブロック」）では未消化ぶんを予算に払い戻す。
 */
export async function expireTempAllow(domain: string, force = false): Promise<void> {
  const now = Date.now();
  const allows = await tempAllowsItem.getValue();
  const entry = allows[domain];
  if (entry === undefined) return;
  if (!force && entry.expiresAt > now + 1000) return; // 延長済み

  const { [domain]: _removed, ...rest } = allows;
  await tempAllowsItem.setValue(rest);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [entry.ruleId],
  });
  await chrome.alarms.clear(tempAllowAlarmName(domain));

  // 早期再ブロックした残り時間は予算へ払い戻す
  const refundSec = Math.round((entry.expiresAt - now) / 1000);
  if (force && refundSec > 0) {
    await recordAllowUsage(domain, -refundSec);
  }

  await sweepBlockedTabs();
}

/**
 * SW 起動時の整合性回復:
 * 期限切れエントリの掃除、生きているエントリの alarm 再武装と session ルール復元、
 * 迷子になった session ルールの削除。
 */
export async function reconcileTempAllows(): Promise<void> {
  const now = Date.now();
  const allows = await tempAllowsItem.getValue();
  const sessionRules = await chrome.declarativeNetRequest.getSessionRules();
  const liveRuleIds = new Set<number>();

  for (const [domain, entry] of Object.entries(allows)) {
    if (entry.expiresAt <= now) {
      await expireTempAllow(domain);
      continue;
    }
    liveRuleIds.add(entry.ruleId);
    if (!sessionRules.some((r) => r.id === entry.ruleId)) {
      await chrome.declarativeNetRequest.updateSessionRules({
        addRules: [
          allowRuleFor(
            entry.ruleId,
            domain,
          ) as unknown as chrome.declarativeNetRequest.Rule,
        ],
      });
    }
    chrome.alarms.create(tempAllowAlarmName(domain), { when: entry.expiresAt });
    scheduleShortExpiry(domain, entry.expiresAt - now);
  }

  // session ルールは当拡張では一時許可専用なので、管理外の ID は削除してよい
  const orphanIds = sessionRules.map((r) => r.id).filter((id) => !liveRuleIds.has(id));
  if (orphanIds.length > 0) {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: orphanIds,
    });
  }
}
