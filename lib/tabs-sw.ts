// 「いま効いているルール」に一致するタブをブロック画面へ送り返す（background 専用）。
//
// DNR は新しいリクエストにしか効かないため、ルールを追加・有効化した時点で
// すでに開いているページはそのまま閲覧できてしまう。コミットメントデバイスとしては
// 穴になるので、ルールが効き始めたタイミングでタブ側も揃える。
//
// 一時許可中のドメインは対象外（許可の意味がなくなるため）。
import { activeRules } from "./active";
import { hostnameOf, isDomainOrSubdomain, matchesUrl } from "./pattern";
import { getSettings, pomodoroItem, tempAllowsItem } from "./storage";

export async function sweepBlockedTabs(): Promise<void> {
  const now = Date.now();
  const [settings, pomodoro, tempAllows] = await Promise.all([
    getSettings(),
    pomodoroItem.getValue(),
    tempAllowsItem.getValue(),
  ]);
  const rules = activeRules(settings, pomodoro, now);
  if (rules.length === 0) return;

  const allowedDomains = Object.entries(tempAllows)
    .filter(([, allow]) => allow.expiresAt > now)
    .map(([domain]) => domain);
  const blockedBase = chrome.runtime.getURL("/blocked.html");

  // ブロック画面自体は chrome-extension:// なので http/https に絞れば対象外になる
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  await Promise.all(
    tabs.map(async (tab) => {
      const url = tab.url;
      if (tab.id === undefined || url === undefined) return;
      if (!rules.some((r) => matchesUrl(r, url))) return;
      const host = hostnameOf(url);
      if (host !== null && allowedDomains.some((d) => isDomainOrSubdomain(host, d))) {
        return;
      }
      try {
        await chrome.tabs.update(tab.id, { url: `${blockedBase}#u=${url}` });
      } catch {
        // 掃除の最中にタブが閉じられた等。1 つ失敗しても他のタブは処理を続ける
        // （ここで throw すると呼び出し元の DNR 同期がエラー扱いになってしまう）
      }
    }),
  );
}
