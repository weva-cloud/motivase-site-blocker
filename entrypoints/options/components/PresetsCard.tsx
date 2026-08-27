import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { findDuplicateRule } from "@/lib/pattern";
import { PRESETS, type Preset } from "@/lib/presets";
import { updateSettings } from "@/lib/storage";
import { type BlockRule, MAX_RULES, type Settings } from "@/lib/types";

/**
 * カテゴリプリセット: 一括登録・一括解除・グループ単位の ON/OFF。
 * まとめて登録できるものは、まとめて解除できなければ使い物にならない。
 */
export const CategoryPresets = ({ settings }: { settings: Settings }) => {
  const toast = useToast();
  const locked = settings.strictMode;

  const addPreset = (preset: Preset) =>
    void updateSettings((s) => {
      const rules = [...s.rules];
      let nextId = s.nextDnrId;
      for (const domain of preset.domains) {
        if (rules.length >= MAX_RULES) break;
        if (findDuplicateRule(rules, { type: "domain", domain }) !== undefined) {
          continue;
        }
        rules.push({
          id: crypto.randomUUID(),
          dnrId: nextId,
          type: "domain",
          domain,
          enabled: true,
          createdAt: Date.now(),
          timing: "always",
          groupId: preset.id,
        });
        nextId += 1;
      }
      return { ...s, rules, nextDnrId: nextId };
    });

  /** このプリセットに属するルール（グループ ID 一致、または同じドメインを個別登録したもの） */
  const rulesOf = (preset: Preset): BlockRule[] =>
    settings.rules.filter(
      (r) =>
        r.groupId === preset.id ||
        (r.type === "domain" && preset.domains.includes(r.domain)),
    );

  const removePreset = (preset: Preset) => {
    const removed = rulesOf(preset);
    if (removed.length === 0) return;
    const removedIds = new Set(removed.map((r) => r.id));
    void updateSettings((s) => ({
      ...s,
      rules: s.rules.filter((r) => !removedIds.has(r.id)),
    }));
    toast({
      message: `${preset.label} の ${removed.length} 件を解除しました`,
      action: {
        label: "元に戻す",
        onClick: () =>
          void updateSettings((s) => ({
            ...s,
            // 取り消しの間に同じルールを再登録していた場合に備えて重複を除く
            rules: [...s.rules.filter((r) => !removedIds.has(r.id)), ...removed],
          })),
      },
    });
  };

  const setGroupEnabled = (preset: Preset, enabled: boolean) => {
    const ids = new Set(rulesOf(preset).map((r) => r.id));
    void updateSettings((s) => ({
      ...s,
      rules: s.rules.map((r) => (ids.has(r.id) ? { ...r, enabled } : r)),
    }));
  };

  return (
    <section>
      <SectionLabel>カテゴリからまとめて登録</SectionLabel>
      <ul>
        {PRESETS.map((preset) => {
          const groupRules = rulesOf(preset);
          const registered = groupRules.length;
          const allEnabled = registered > 0 && groupRules.every((r) => r.enabled);
          const complete = preset.domains.every(
            (domain) =>
              findDuplicateRule(settings.rules, { type: "domain", domain }) !== undefined,
          );

          return (
            <li
              key={preset.id}
              className="flex items-center gap-4 border-b hairline py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {preset.label}
                  <span className="text-xs font-normal text-muted tabular-nums">
                    {registered > 0
                      ? `${registered} / ${preset.domains.length} 件登録済み`
                      : `${preset.domains.length} サイト`}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted">
                  {preset.domains.join("　")}
                </div>
              </div>

              {registered > 0 && (
                <Switch
                  checked={allEnabled}
                  disabled={locked && allEnabled}
                  onChange={(v) => setGroupEnabled(preset, v)}
                  aria-label={`${preset.label} のブロックをまとめて切り替え`}
                />
              )}
              {registered > 0 && (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={locked}
                  onClick={() => removePreset(preset)}
                >
                  まとめて解除
                </Button>
              )}
              {!complete && (
                <Button size="sm" onClick={() => addPreset(preset)}>
                  追加
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
