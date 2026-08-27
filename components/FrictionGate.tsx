import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { formatDurationJa } from "@/lib/format";
import type { FrictionSettings } from "@/lib/types";

interface Props {
  friction: FrictionSettings;
  /** 開こうとしている許可時間（秒）。表示用 */
  durationSec: number;
  onConfirm: (reason: string | undefined) => void;
  onCancel: () => void;
  busy?: boolean;
}

/**
 * 一時許可の前に挟む「衝動ブレーキ」。
 * 数秒の待機（one sec 式）と理由の言語化で、反射的なアクセスを
 * 意識的な選択に変える。
 */
export const FrictionGate = ({
  friction,
  durationSec,
  onConfirm,
  onCancel,
  busy,
}: Props) => {
  const [remaining, setRemaining] = useState(friction.waitSec);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const reasonOk = !friction.requireReason || reason.trim().length >= 2;
  const ready = remaining === 0 && reasonOk;

  return (
    <div className="sunken rounded-lg p-4">
      <p className="text-sm font-medium">本当にいま開く必要がありますか？</p>
      <p className="mt-1 text-xs text-muted">
        ひと呼吸おいて考えてみましょう。開くと {formatDurationJa(durationSec)}
        だけ閲覧できます。
      </p>

      {friction.requireReason && (
        <TextField
          className="mt-3"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="開く理由を書いてください（例: 仕事の資料を確認する）"
          aria-label="開く理由"
          autoFocus
        />
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!ready || busy === true}
          onClick={() => onConfirm(reason.trim() === "" ? undefined : reason.trim())}
        >
          {remaining > 0 ? (
            <span className="tabular-nums">あと {remaining} 秒…</span>
          ) : (
            "開く"
          )}
        </Button>
        <Button size="sm" onClick={onCancel} disabled={busy === true}>
          やめておく
        </Button>
      </div>
      {friction.requireReason && !reasonOk && remaining === 0 && (
        <p className="mt-2 text-xs text-muted">理由を入力すると開けます</p>
      )}
    </div>
  );
};
