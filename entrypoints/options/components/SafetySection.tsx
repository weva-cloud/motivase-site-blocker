import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { updateSettings } from "@/lib/storage";
import { STR } from "@/lib/strings";
import type { Settings } from "@/lib/types";

/** 厳格モード解除のタイプチャレンジ（コミットメントデバイス） */
const UNLOCK_PHRASE = "私は一時の気晴らしより自分の目標を優先します";

export const SafetySection = ({ settings }: { settings: Settings }) => {
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const setStrict = (strictMode: boolean) =>
    void updateSettings((s) => ({ ...s, strictMode }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">{STR.sectionSafety}</h1>
        <p className="mt-1 text-sm text-muted">
          ブロッカー最大の敵は「未来の自分による設定解除」。
          先に自分を縛っておくのが、いちばん確実な集中の守り方です。
        </p>
      </header>

      <Card
        title="厳格モード"
        action={
          settings.strictMode ? (
            <span className="flex items-center gap-1 text-xs font-medium text-accent-600 dark:text-accent-400">
              <Icon name="lock" size={13} />
              有効
            </span>
          ) : undefined
        }
      >
        <p className="mb-3 text-xs text-muted">
          有効にすると、ルールの削除・無効化、一時許可やスケジュールの設定変更が
          できなくなります。解除には決意の一文の入力が必要です。 （chrome://extensions
          からの拡張自体の無効化までは防げません）
        </p>
        {settings.strictMode ? (
          <Button
            onClick={() => {
              setTyped("");
              setUnlockOpen(true);
            }}
          >
            厳格モードを解除する…
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setStrict(true)}>
            <Icon name="shield" size={15} />
            厳格モードを有効にする
          </Button>
        )}
      </Card>

      <Card
        title="週次振り返り通知"
        action={
          <Switch
            checked={settings.weeklyReview}
            onChange={(weeklyReview) =>
              void updateSettings((s) => ({ ...s, weeklyReview }))
            }
            aria-label="週次振り返り通知"
          />
        }
      >
        <p className="text-xs text-muted">
          毎週月曜 9:00 に、先週のポモドーロ数・ブロック回数・一時許可時間を
          通知でお知らせします。
        </p>
      </Card>

      <Modal
        open={unlockOpen}
        title="厳格モードを解除しますか？"
        onClose={() => setUnlockOpen(false)}
        footer={
          <>
            <Button onClick={() => setUnlockOpen(false)}>やめておく</Button>
            <Button
              variant="danger"
              disabled={typed.trim() !== UNLOCK_PHRASE}
              onClick={() => {
                setStrict(false);
                setUnlockOpen(false);
              }}
            >
              解除する
            </Button>
          </>
        }
      >
        <p>解除するには、次の一文を正確に入力してください。</p>
        <p className="sunken my-3 rounded-lg p-3 font-medium select-none">
          {UNLOCK_PHRASE}
        </p>
        <TextField
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="上の一文を入力"
          aria-label="解除の一文"
        />
      </Modal>
    </div>
  );
};
