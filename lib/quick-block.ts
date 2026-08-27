// キーボードショートカット / 右クリックメニューからのワンアクションブロック（background 専用）。
import { syncDynamicRules } from "./dnr-sync";
import {
  findDuplicateRule,
  hostnameOf,
  matchingRules,
  parsePatternInput,
} from "./pattern";
import { getSettings, updateSettings } from "./storage";
import { STR } from "./strings";
import { MAX_RULES } from "./types";

function notify(message: string): void {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("/icon/128.png"),
    title: STR.appName,
    message,
  });
}

/** アクティブタブのサイトをドメイン全体でブロックする */
export async function quickBlockTab(tab: chrome.tabs.Tab | undefined): Promise<void> {
  const url = tab?.url;
  const host = url !== undefined ? hostnameOf(url) : null;
  if (tab?.id === undefined || url === undefined || host === null) {
    notify("このページはブロックできません（http / https のサイトのみ）");
    return;
  }

  const settings = await getSettings();
  if (matchingRules(settings.rules, url).length > 0) {
    notify(`${host} はすでにブロック対象です`);
    return;
  }
  if (settings.rules.length >= MAX_RULES) {
    notify(STR.errRuleLimit);
    return;
  }
  const parsed = parsePatternInput(host);
  if (!parsed.ok) {
    notify("このページはブロックできません");
    return;
  }
  if (findDuplicateRule(settings.rules, parsed.parsed) !== undefined) {
    notify(STR.errDuplicateRule);
    return;
  }

  await updateSettings((s) => ({
    ...s,
    rules: [
      ...s.rules,
      {
        id: crypto.randomUUID(),
        dnrId: s.nextDnrId,
        enabled: true,
        createdAt: Date.now(),
        timing: "always",
        ...parsed.parsed,
      },
    ],
    nextDnrId: s.nextDnrId + 1,
  }));
  // 同期の最後で sweepBlockedTabs() が走り、このタブもブロック画面へ送り返される
  await syncDynamicRules();
  notify(`🚫 ${parsed.parsed.domain} をブロックしました`);
}
