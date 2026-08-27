import { useState } from "react";
import { FrictionGate } from "@/components/FrictionGate";
import { Button } from "@/components/ui/Button";
import { formatDurationJa } from "@/lib/format";
import { sendToBackground } from "@/lib/messages";
import { STR } from "@/lib/strings";
import type { FrictionSettings } from "@/lib/types";

interface Props {
  domain: string;
  durations: number[];
  friction: FrictionSettings;
  /** 許可成立後の後処理（タブの再読み込み等）。完了後にポップアップを閉じる */
  afterAllow?: () => Promise<void>;
}

export const TempAllowButtons = ({ domain, durations, friction, afterAllow }: Props) => {
  const [selectedSec, setSelectedSec] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (durations.length === 0) return null;

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
      await afterAllow?.();
      window.close();
    } else {
      setError(res.error);
      setBusy(false);
      setSelectedSec(null);
    }
  };

  return (
    <div>
      {selectedSec === null ? (
        <>
          <p className="mb-1.5 text-[11px] text-muted">{STR.tempAllowLead}</p>
          <div className="flex flex-wrap gap-1.5">
            {[...durations]
              .sort((a, b) => a - b)
              .map((sec) => (
                <Button
                  key={sec}
                  size="sm"
                  disabled={busy}
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
              ))}
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
      {error !== null && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
};
