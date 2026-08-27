import { Icon } from "@/components/ui/Icon";
import { activeRules, isFocusLock } from "@/lib/active";
import { useActiveTab } from "@/lib/hooks/useActiveTab";
import { useSettings } from "@/lib/hooks/useSettings";
import { useStorageItem } from "@/lib/hooks/useStorageItem";
import { useTheme } from "@/lib/hooks/useTheme";
import {
  broadestAllowDomain,
  hostnameOf,
  isDomainOrSubdomain,
  matchesUrl,
} from "@/lib/pattern";
import { pomodoroItem, tempAllowsItem } from "@/lib/storage";
import { STR } from "@/lib/strings";
import { BlockStatusCard, type PopupStatus } from "./components/BlockStatusCard";

const App = () => {
  const tab = useActiveTab();
  const settings = useSettings();
  const pomodoro = useStorageItem(pomodoroItem);
  const tempAllows = useStorageItem(tempAllowsItem);
  useTheme(settings?.theme);

  const loading =
    tab === undefined ||
    settings === undefined ||
    pomodoro === undefined ||
    tempAllows === undefined;

  let status: PopupStatus = { kind: "notBlockable" };
  if (!loading && tab !== null) {
    const url = tab.url ?? "";
    const blockedBase = chrome.runtime.getURL("/blocked.html");
    const rules = activeRules(settings, pomodoro, Date.now());

    if (url.startsWith(blockedBase)) {
      // ブロック画面を開いているタブ: hash から元 URL を復元して扱う
      const hashIndex = url.indexOf("#u=");
      const originalUrl = hashIndex >= 0 ? url.slice(hashIndex + 3) : null;
      if (originalUrl !== null) {
        const matched = rules.filter((r) => matchesUrl(r, originalUrl));
        status = {
          kind: "blocked",
          url: originalUrl,
          host: hostnameOf(originalUrl) ?? "",
          allowDomain: broadestAllowDomain(matched),
          tabOnBlockedPage: true,
        };
      }
    } else {
      const host = hostnameOf(url);
      if (host !== null) {
        const now = Date.now();
        const allowEntry = Object.entries(tempAllows).find(
          ([domain, allow]) => allow.expiresAt > now && isDomainOrSubdomain(host, domain),
        );
        const matched = rules.filter((r) => matchesUrl(r, url));
        if (allowEntry !== undefined) {
          status = {
            kind: "tempAllowed",
            domain: allowEntry[0],
            expiresAt: allowEntry[1].expiresAt,
            host,
          };
        } else if (matched.length > 0) {
          status = {
            kind: "blocked",
            url,
            host,
            allowDomain: broadestAllowDomain(matched),
            tabOnBlockedPage: false,
          };
        } else {
          status = { kind: "unblocked", url, host };
        }
      }
    }
  }

  return (
    <div className="w-90 p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/icon/48.png" alt="" className="size-5 rounded" />
          <span className="text-sm font-semibold">{STR.appName}</span>
        </div>
        <button
          type="button"
          onClick={() => chrome.runtime.openOptionsPage()}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.07]"
        >
          <Icon name="sliders" size={14} />
          {STR.openOptions}
        </button>
      </header>

      {loading ? (
        <div className="py-10 text-center text-xs text-muted">読み込み中…</div>
      ) : (
        <BlockStatusCard
          status={status}
          tab={tab}
          settings={settings}
          focusLock={isFocusLock(settings, pomodoro)}
        />
      )}
    </div>
  );
};

export default App;
