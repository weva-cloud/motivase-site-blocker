import { useEffect, useState } from "react";
import { PatternTypeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { Favicon } from "@/components/ui/Favicon";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { ruleLabel } from "@/lib/pattern";
import { updateSettings } from "@/lib/storage";
import { STR } from "@/lib/strings";
import type { BlockRule, Settings } from "@/lib/types";

/** 展開時の詳細編集（タイミング / 理由） */
const RuleDetailEditor = ({ rule, locked }: { rule: BlockRule; locked: boolean }) => {
  const savedReason = rule.reason ?? "";
  const [reason, setReason] = useState(savedReason);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = reason.trim() !== savedReason;

  const patch = (partial: Partial<BlockRule>) =>
    void updateSettings((s) => ({
      ...s,
      rules: s.rules.map((r) => (r.id === rule.id ? { ...r, ...partial } : r)),
    }));

  // 保存されたことが分かるように、明示的な保存操作と結果表示を用意する
  // （入力欄を離れたときの自動保存も残すので、書きかけが消えることはない）
  const commitReason = () => {
    if (!dirty) return;
    const trimmed = reason.trim();
    patch({ reason: trimmed === "" ? undefined : trimmed });
    setJustSaved(true);
  };

  useEffect(() => {
    if (!justSaved) return;
    const id = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(id);
  }, [justSaved]);

  return (
    <div className="sunken space-y-3 rounded-lg p-3.5">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-xs text-muted">ブロックする時間</span>
        {(
          [
            ["always", "常時"],
            ["schedule", "スケジュール時のみ"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name={`timing-${rule.id}`}
              checked={rule.timing === value}
              disabled={locked}
              onChange={() => patch({ timing: value })}
              className="accent-amber-500"
            />
            {label}
          </label>
        ))}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <TextField
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setJustSaved(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitReason();
              }
            }}
            onBlur={commitReason}
            placeholder="ブロックする理由（ブロック画面に表示されます）"
            aria-label={`${ruleLabel(rule)} をブロックする理由`}
          />
          <Button
            size="sm"
            variant={dirty ? "primary" : "ghost"}
            disabled={!dirty}
            className="shrink-0"
            onClick={commitReason}
          >
            保存
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          {dirty
            ? "未保存の変更があります（Enter でも保存できます）"
            : justSaved
              ? "保存しました"
              : "入力すると保存ボタンが有効になります"}
        </p>
      </div>
    </div>
  );
};

export const RuleList = ({ settings }: { settings: Settings }) => {
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toast = useToast();
  const locked = settings.strictMode;

  const rules = [...settings.rules]
    .sort((a, b) => b.createdAt - a.createdAt)
    .filter(
      (r) => filter.trim() === "" || ruleLabel(r).includes(filter.trim().toLowerCase()),
    );

  const setEnabled = (id: string, enabled: boolean) =>
    void updateSettings((s) => ({
      ...s,
      rules: s.rules.map((r) => (r.id === id ? { ...r, enabled } : r)),
    }));

  /**
   * 削除は確認をはさまず即実行し、代わりに「元に戻す」を出す。
   * 削除は取り消せる操作なので、毎回ダイアログで手を止めさせる価値がない。
   */
  const remove = (rule: BlockRule) => {
    void updateSettings((s) => ({
      ...s,
      rules: s.rules.filter((r) => r.id !== rule.id),
    }));
    toast({
      message: `${ruleLabel(rule)} のブロックを解除しました`,
      action: {
        label: "元に戻す",
        onClick: () =>
          void updateSettings((s) => ({
            ...s,
            rules: [...s.rules.filter((r) => r.id !== rule.id), rule],
          })),
      },
    });
  };

  if (settings.rules.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium">まだルールがありません</p>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted">
          上のフォームにサイトを入力するか、ブロックしたいサイトを開いて
          ツールバーの拡張アイコンから「このサイトをブロック」を押してください。
        </p>
      </div>
    );
  }

  return (
    <section>
      <SectionLabel
        action={
          settings.rules.length > 5 ? (
            <div className="relative w-56">
              <Icon
                name="search"
                size={15}
                className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted"
              />
              <TextField
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="ルールを検索"
                aria-label="ルールを検索"
                className="!pl-8"
              />
            </div>
          ) : undefined
        }
      >
        登録済み（{settings.rules.length}）
      </SectionLabel>

      {locked && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-accent-600 dark:text-accent-400">
          <Icon name="lock" size={14} />
          {STR.strictLocked}（追加は可能です）
        </p>
      )}

      <ul>
        {rules.map((rule) => (
          <li key={rule.id} className="border-b hairline py-2.5 last:border-b-0">
            <div className="flex items-center gap-3">
              <Favicon domain={rule.domain} size={20} />
              <span
                className={`min-w-0 flex-1 truncate font-mono text-sm ${
                  rule.enabled ? "" : "text-muted line-through"
                }`}
              >
                {ruleLabel(rule)}
              </span>
              {rule.timing === "schedule" && (
                <Icon
                  name="calendar"
                  size={15}
                  className="text-muted"
                  aria-label="スケジュール時のみブロック"
                />
              )}
              <PatternTypeBadge type={rule.type} />
              <Switch
                checked={rule.enabled}
                disabled={locked && rule.enabled}
                onChange={(v) => setEnabled(rule.id, v)}
                aria-label={`${ruleLabel(rule)} のブロックを${rule.enabled ? "無効" : "有効"}にする`}
              />
              <Button
                variant="quiet"
                size="sm"
                aria-label={`${ruleLabel(rule)} を編集`}
                aria-expanded={expandedId === rule.id}
                onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
              >
                <Icon name="pencil" size={15} />
              </Button>
              <Button
                variant="quiet"
                size="sm"
                disabled={locked}
                className="hover:text-red-600 dark:hover:text-red-400"
                onClick={() => remove(rule)}
                aria-label={`${ruleLabel(rule)} を削除`}
              >
                <Icon name="trash" size={15} />
              </Button>
            </div>
            {rule.reason !== undefined && expandedId !== rule.id && (
              <p className="mt-1 truncate pl-8 text-xs text-muted">{rule.reason}</p>
            )}
            {expandedId === rule.id && (
              <div className="mt-3">
                <RuleDetailEditor rule={rule} locked={locked} />
              </div>
            )}
          </li>
        ))}
        {rules.length === 0 && (
          <li className="py-8 text-center text-xs text-muted">
            「{filter}」に一致するルールはありません
          </li>
        )}
      </ul>
    </section>
  );
};
