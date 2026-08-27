import { Button } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Favicon } from "@/components/ui/Favicon";
import { Icon } from "@/components/ui/Icon";
import { sendToBackground } from "@/lib/messages";
import { STR } from "@/lib/strings";
import type { Settings } from "@/lib/types";
import { QuickBlockForm } from "./QuickBlockForm";
import { TempAllowButtons } from "./TempAllowButtons";

export type PopupStatus =
  | { kind: "notBlockable" }
  | {
      kind: "blocked";
      /** 元のサイト URL（ブロック画面タブの場合は hash から復元したもの） */
      url: string;
      host: string;
      allowDomain: string | null;
      /** タブが既にブロック画面を表示しているか */
      tabOnBlockedPage: boolean;
    }
  | { kind: "tempAllowed"; domain: string; expiresAt: number; host: string }
  | { kind: "unblocked"; url: string; host: string };

interface Props {
  status: PopupStatus;
  tab: chrome.tabs.Tab | null;
  settings: Settings;
  /** フォーカスモードの作業中（一時許可は禁止） */
  focusLock: boolean;
}

const SiteRow = ({ host, favIconUrl }: { host: string; favIconUrl?: string }) => {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <Favicon domain={host} src={favIconUrl} size={28} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{host}</span>
    </div>
  );
};

export const BlockStatusCard = ({ status, tab, settings, focusLock }: Props) => {
  switch (status.kind) {
    case "notBlockable":
      return (
        <div className="card p-5 text-center">
          <p className="text-sm font-medium">{STR.notBlockable}</p>
          <p className="mt-1.5 text-xs text-muted">{STR.notBlockableHint}</p>
        </div>
      );

    case "tempAllowed":
      return (
        <div className="card p-5">
          <SiteRow host={status.host} favIconUrl={tab?.favIconUrl} />
          <div className="mb-3 flex items-center justify-between rounded-lg bg-accent-500/10 px-3 py-2.5">
            <span className="text-sm font-medium text-accent-600 dark:text-accent-400">
              {STR.tempAllowActive}
            </span>
            <Countdown until={status.expiresAt} className="text-sm font-bold" />
          </div>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              // 失効処理がタブをブロック画面へ送り返す
              void sendToBackground({
                type: "TEMP_ALLOW_REVOKE",
                domain: status.domain,
              }).then(() => window.close());
            }}
          >
            {STR.reblockNow}
          </Button>
        </div>
      );

    case "blocked":
      return (
        <div className="card p-5">
          <SiteRow host={status.host} />
          <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <Icon name="ban" size={15} />
            {STR.siteIsBlocked}
          </p>
          {!status.tabOnBlockedPage && tab?.id !== undefined && (
            <Button
              className="mb-3 w-full"
              onClick={() => {
                const blockedUrl = `${chrome.runtime.getURL("/blocked.html")}#u=${status.url}`;
                void chrome.tabs
                  .update(tab.id as number, { url: blockedUrl })
                  .then(() => window.close());
              }}
            >
              {STR.goToBlockedPage}
            </Button>
          )}
          {focusLock ? (
            <p className="flex items-center gap-1.5 rounded-lg bg-accent-500/10 px-3 py-2.5 text-xs font-medium text-accent-600 dark:text-accent-400">
              <Icon name="lock" size={14} />
              フォーカスモード中は一時許可できません
            </p>
          ) : (
            status.allowDomain !== null && (
              <TempAllowButtons
                domain={status.allowDomain}
                durations={settings.allowDurations}
                friction={settings.friction}
                afterAllow={async () => {
                  // 許可が効いたので元のサイトを開き直す
                  if (tab?.id !== undefined) {
                    if (status.tabOnBlockedPage) {
                      await chrome.tabs.update(tab.id, { url: status.url });
                    } else {
                      await chrome.tabs.reload(tab.id);
                    }
                  }
                }}
              />
            )
          )}
        </div>
      );

    case "unblocked":
      return (
        <QuickBlockForm
          tab={tab}
          url={status.url}
          host={status.host}
          settings={settings}
        />
      );
  }
};
