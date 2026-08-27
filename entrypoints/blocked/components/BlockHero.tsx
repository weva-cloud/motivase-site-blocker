import { Button } from "@/components/ui/Button";
import { Favicon } from "@/components/ui/Favicon";
import { STR } from "@/lib/strings";
import { MotivationCard } from "./MotivationCard";

interface Props {
  /** null = ダッシュボードモード（hash なしで直接開かれた） */
  originalUrl: string | null;
  host: string | null;
  /** 元 URL が今も有効なルールにマッチしているか */
  isStillBlocked: boolean;
  /** このサイトをブロックした理由（実装意図）。ルールに登録があれば表示 */
  reason?: string;
  /** やる気メッセージ（ウィジェット無効時は空配列） */
  messages: string[];
}

export const BlockHero = ({
  originalUrl,
  host,
  isStillBlocked,
  reason,
  messages,
}: Props) => {
  const isBlockedView = originalUrl !== null && isStillBlocked;

  return (
    <header className="flex w-full flex-col items-center gap-4 text-center">
      {host !== null && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Favicon domain={host} size={16} />
          <span className="max-w-64 truncate">{host}</span>
        </div>
      )}

      {isBlockedView ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">{STR.blockedTitle}</h1>
          <p className="-mt-2 text-sm text-muted">{STR.blockedSubtitle}</p>
          {reason !== undefined && (
            <p className="text-sm">
              <span className="text-muted">この時間を守る理由</span>
              <span className="ml-2 font-medium">{reason}</span>
            </p>
          )}
        </>
      ) : originalUrl !== null ? (
        <>
          <h1 className="text-xl font-semibold">{STR.alreadyUnblocked}</h1>
          <Button
            variant="primary"
            onClick={() => {
              window.location.href = originalUrl;
            }}
          >
            {STR.openSite}
          </Button>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">{STR.dashboardTitle}</h1>
          <p className="-mt-2 text-sm text-muted">
            サイトをブロックすると、この画面が代わりに表示されます
          </p>
        </>
      )}

      {messages.length > 0 && <MotivationCard messages={messages} />}
    </header>
  );
};
