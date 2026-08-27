import { useState } from "react";
import { FrictionGate } from "@/components/FrictionGate";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatDurationJa } from "@/lib/format";
import { sendToBackground } from "@/lib/messages";
import { STR } from "@/lib/strings";
import type { FrictionSettings } from "@/lib/types";

interface Props {
  originalUrl: string;
  /** 許可対象ドメイン（マッチしたルールのうち最も広いもの） */
  domain: string;
  /** 提供する許可時間（秒） */
  durations: number[];
  friction: FrictionSettings;
  /** フォーカスモードの作業中は一時許可を出さない */
  focusLock: boolean;
  /** 日次予算の残り秒。null = 予算なし */
  budgetRemainingSec: number | null;
}

/** 「10秒だけ開く」…の一時許可（摩擦ゲート・予算・フォーカスロック対応） */
export const TempAllowBar = ({
  originalUrl,
  domain,
  durations,
  friction,
  focusLock,
  budgetRemainingSec,
}: Props) => {
  const [selectedSec, setSelectedSec] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (durations.length === 0) return null;

  if (focusLock) {
    return (
      <section className="w-full border-t hairline pt-5 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium">
          <Icon name="lock" size={15} />
          フォーカスモード中は一時許可できません
        </p>
        <p className="mt-1 text-xs text-muted">
          いまは作業ポモドーロの時間です。終わってからまた考えましょう。
        </p>
      </section>
    );
  }

  const allow = async (durationSec: number, reason: string | undefined) => {
    setBusy(true);
    setError(null);
    const res = await sendToBackground({
      type: "TEMP_ALLOW",
      domain,
      durationSec,
      reason,
    });
    if (res.ok) {
      // allow ルールが有効になったので元のサイトへ戻る
      window.location.href = originalUrl;
    } else {
      setError(res.error);
      setBusy(false);
      setSelectedSec(null);
    }
  };

  return (
    <section className="w-full border-t hairline pt-5">
      {selectedSec === null ? (
        <>
          <p className="mb-2.5 text-center text-xs text-muted">
            {STR.tempAllowLead}
            {budgetRemainingSec !== null &&
              `（今日の残り ${formatDurationJa(budgetRemainingSec)}）`}
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {[...durations]
              .sort((a, b) => a - b)
              .map((sec) => {
                const overBudget =
                  budgetRemainingSec !== null && sec > budgetRemainingSec;
                return (
                  <Button
                    key={sec}
                    size="sm"
                    variant="quiet"
                    disabled={busy || overBudget}
                    title={overBudget ? "今日の予算が足りません" : undefined}
                    onClick={() => {
                      if (friction.waitSec === 0 && !friction.requireReason) {
                        void allow(sec, undefined);
                      } else {
                        setSelectedSec(sec);
                        setError(null);
                      }
                    }}
                  >
                    {STR.tempAllowButton(formatDurationJa(sec))}
                  </Button>
                );
              })}
          </div>
        </>
      ) : (
        <FrictionGate
          friction={friction}
          durationSec={selectedSec}
          busy={busy}
          onConfirm={(reason) => void allow(selectedSec, reason)}
          onCancel={() => setSelectedSec(null)}
        />
      )}

      {error !== null && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}
    </section>
  );
};
