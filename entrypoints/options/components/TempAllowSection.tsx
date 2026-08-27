import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Countdown } from "@/components/ui/Countdown";
import { Favicon } from "@/components/ui/Favicon";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { formatDurationJa } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";
import { useStorageItem } from "@/lib/hooks/useStorageItem";
import { sendToBackground } from "@/lib/messages";
import { tempAllowsItem, updateSettings } from "@/lib/storage";
import { STR } from "@/lib/strings";
import {
  ALLOW_DURATION_MAX_SEC,
  ALLOW_DURATION_MIN_SEC,
  MAX_ALLOW_DURATIONS,
  type Settings,
} from "@/lib/types";

export const TempAllowSection = ({ settings }: { settings: Settings }) => {
  const tempAllows = useStorageItem(tempAllowsItem);
  const now = useNow(1000);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<"sec" | "min">("min");
  const [error, setError] = useState<string | null>(null);
  const locked = settings.strictMode;

  const durations = [...settings.allowDurations].sort((a, b) => a - b);
  const activeAllows = Object.entries(tempAllows ?? {}).filter(
    ([, allow]) => allow.expiresAt > now,
  );

  const add = () => {
    setError(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("時間を数値で入力してください");
      return;
    }
    const sec = Math.round(unit === "min" ? n * 60 : n);
    if (sec < ALLOW_DURATION_MIN_SEC || sec > ALLOW_DURATION_MAX_SEC) {
      setError(
        `${formatDurationJa(ALLOW_DURATION_MIN_SEC)}〜${formatDurationJa(ALLOW_DURATION_MAX_SEC)}の範囲で指定してください`,
      );
      return;
    }
    if (durations.includes(sec)) {
      setError("同じ時間がすでに登録されています");
      return;
    }
    if (durations.length >= MAX_ALLOW_DURATIONS) {
      setError(`選択肢は最大 ${MAX_ALLOW_DURATIONS} 個までです`);
      return;
    }
    void updateSettings((s) => ({
      ...s,
      allowDurations: [...s.allowDurations, sec].sort((a, b) => a - b),
    }));
    setAmount("");
  };

  const remove = (sec: number) =>
    void updateSettings((s) => ({
      ...s,
      allowDurations: s.allowDurations.filter((d) => d !== sec),
    }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">{STR.sectionTempAllow}</h1>
        <p className="mt-1 text-sm text-muted">
          ブロック画面に表示する「◯◯だけ開く」ボタンと、開く前の
          「ひと呼吸」の仕掛けを設定します。
        </p>
      </header>

      {locked && (
        <p className="flex items-center gap-1.5 rounded-lg bg-accent-500/[0.08] px-4 py-3 text-sm font-medium text-accent-600 dark:text-accent-400">
          {STR.strictLocked}
        </p>
      )}

      <Card title="開く前のひと呼吸（摩擦）">
        <p className="mb-3 text-xs text-muted">
          ワンクリックで開けてしまうと衝動に勝てません。数秒の待機と理由の言語化で、
          反射的なアクセスを意識的な選択に変えます。
        </p>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span>開くまでの待機</span>
            <input
              type="number"
              min={0}
              max={120}
              disabled={locked}
              value={settings.friction.waitSec}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0 && n <= 120) {
                  void updateSettings((s) => ({
                    ...s,
                    friction: { ...s.friction, waitSec: Math.round(n) },
                  }));
                }
              }}
              className="w-20 rounded-lg border hairline bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-accent-500/70"
            />
            <span className="text-muted">秒（0 で待機なし）</span>
          </label>
          <label className="flex cursor-pointer items-center justify-between text-sm">
            <span>開く理由の入力を必須にする</span>
            <Switch
              checked={settings.friction.requireReason}
              disabled={locked}
              onChange={(requireReason) =>
                void updateSettings((s) => ({
                  ...s,
                  friction: { ...s.friction, requireReason },
                }))
              }
              aria-label="理由の入力を必須にする"
            />
          </label>
        </div>
      </Card>

      <Card title="1日の許可時間の予算">
        <p className="mb-3 text-xs text-muted">
          ドメインごとに 1 日に一時許可できる合計時間へ上限を設けます。
          使い切ったらその日はもう開けません（早めの再ブロックで残りは戻ります）。
        </p>
        <div className="flex items-center gap-3">
          <Switch
            checked={settings.tempAllowBudgetMin !== null}
            disabled={locked}
            onChange={(on) =>
              void updateSettings((s) => ({
                ...s,
                tempAllowBudgetMin: on ? 30 : null,
              }))
            }
            aria-label="日次予算を有効にする"
          />
          {settings.tempAllowBudgetMin !== null ? (
            <label className="flex items-center gap-2 text-sm">
              1日
              <input
                type="number"
                min={1}
                max={720}
                disabled={locked}
                value={settings.tempAllowBudgetMin}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 1 && n <= 720) {
                    void updateSettings((s) => ({
                      ...s,
                      tempAllowBudgetMin: Math.round(n),
                    }));
                  }
                }}
                className="w-20 rounded-lg border hairline bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-accent-500/70"
              />
              分まで
            </label>
          ) : (
            <span className="text-sm text-muted">無制限</span>
          )}
        </div>
      </Card>

      <Card title="許可時間の選択肢">
        {durations.length === 0 ? (
          <p className="mb-3 text-xs text-muted">
            選択肢がありません。この状態ではブロック画面から一時許可できません（最も強力な設定です）。
          </p>
        ) : (
          <div className="mb-4 flex flex-wrap gap-2">
            {durations.map((sec) => (
              <span
                key={sec}
                className="inline-flex items-center gap-1 rounded-lg border hairline py-1.5 pr-1.5 pl-3 text-sm tabular-nums"
              >
                {formatDurationJa(sec)}
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => remove(sec)}
                  className="cursor-pointer rounded p-1 text-muted transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`${formatDurationJa(sec)} を削除`}
                >
                  <Icon name="x" size={13} />
                </button>
              </span>
            ))}
          </div>
        )}

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            type="number"
            min={1}
            disabled={locked}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5"
            aria-label="許可時間"
            className="w-24 rounded-lg border hairline bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-accent-500/70"
          />
          <select
            value={unit}
            disabled={locked}
            onChange={(e) => setUnit(e.target.value as "sec" | "min")}
            aria-label="単位"
            className="cursor-pointer rounded-lg border hairline bg-transparent px-2 py-2 text-sm outline-none"
          >
            <option value="sec">秒</option>
            <option value="min">分</option>
          </select>
          <Button type="submit" disabled={locked}>
            <Icon name="plus" size={15} />
            追加
          </Button>
        </form>
        {error !== null && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </Card>

      <Card title="現在有効な一時許可">
        {activeAllows.length === 0 ? (
          <p className="text-xs text-muted">現在、一時許可中のサイトはありません。</p>
        ) : (
          <ul>
            {activeAllows.map(([domain, allow]) => (
              <li
                key={domain}
                className="flex items-center gap-3 border-b hairline py-2.5 last:border-b-0"
              >
                <Favicon domain={domain} size={22} />
                <span className="min-w-0 flex-1 truncate font-mono text-sm">
                  {domain}
                </span>
                <Countdown
                  until={allow.expiresAt}
                  className="text-sm font-medium text-accent-600 dark:text-accent-400"
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    void sendToBackground({ type: "TEMP_ALLOW_REVOKE", domain })
                  }
                >
                  {STR.reblockNow}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
