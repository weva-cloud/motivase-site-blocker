import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { regexFilterFor } from "@/lib/dnr";
import { findDuplicateRule, type ParsedPattern, parsePatternInput } from "@/lib/pattern";
import { updateSettings } from "@/lib/storage";
import { STR } from "@/lib/strings";
import { MAX_RULES, type Settings } from "@/lib/types";
import { PatternPreview } from "./PatternPreview";

/** 入力しながらリアルタイムにプレビューが出るルール追加フォーム */
export const AddRuleForm = ({ settings }: { settings: Settings }) => {
  const [input, setInput] = useState("");
  const [includeSubdomains, setIncludeSubdomains] = useState(true);
  const [timing, setTiming] = useState<"always" | "schedule">("always");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parse = useMemo(() => parsePatternInput(input), [input]);

  // 「サブドメインも含める」を外したら domain 型 → host 型に切り替える
  const pattern: ParsedPattern | null = useMemo(() => {
    if (!parse.ok) return null;
    if (parse.parsed.type === "domain" && !includeSubdomains) {
      return { type: "host", domain: parse.exactHost };
    }
    return parse.parsed;
  }, [parse, includeSubdomains]);

  const add = async () => {
    if (pattern === null) return;
    setBusy(true);
    setError(null);

    if (settings.rules.length >= MAX_RULES) {
      setError(STR.errRuleLimit);
      setBusy(false);
      return;
    }
    if (findDuplicateRule(settings.rules, pattern) !== undefined) {
      setError(STR.errDuplicateRule);
      setBusy(false);
      return;
    }
    const { isSupported } = await chrome.declarativeNetRequest.isRegexSupported({
      regex: regexFilterFor(pattern),
      isCaseSensitive: false,
    });
    if (!isSupported) {
      setError(STR.errRuleUnsupported);
      setBusy(false);
      return;
    }

    const trimmedReason = reason.trim();
    await updateSettings((s) => ({
      ...s,
      rules: [
        ...s.rules,
        {
          id: crypto.randomUUID(),
          dnrId: s.nextDnrId,
          enabled: true,
          createdAt: Date.now(),
          timing,
          ...(trimmedReason !== "" ? { reason: trimmedReason } : {}),
          ...pattern,
        },
      ],
      nextDnrId: s.nextDnrId + 1,
    }));
    setInput("");
    setIncludeSubdomains(true);
    setTiming("always");
    setReason("");
    setBusy(false);
  };

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <TextField
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          placeholder="例: youtube.com、x.com/home、*.example.com"
          aria-label="ブロックするサイトのパターン"
          autoFocus
        />
        <Button
          type="submit"
          variant="primary"
          disabled={pattern === null || busy}
          className="shrink-0"
        >
          <Icon name="plus" size={16} />
          追加
        </Button>
      </form>

      {input.trim() !== "" && !parse.ok && (
        <p className="mt-2 text-xs text-red-500">{parse.error}</p>
      )}
      {error !== null && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {input.trim() !== "" && parse.ok && pattern !== null && (
        <>
          <PatternPreview
            pattern={pattern}
            note={parse.note}
            subdomainToggle={
              parse.parsed.type === "domain"
                ? { value: includeSubdomains, onChange: setIncludeSubdomains }
                : undefined
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
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
                  name="timing"
                  checked={timing === value}
                  onChange={() => setTiming(value)}
                  className="accent-amber-500"
                />
                {label}
              </label>
            ))}
          </div>
          <TextField
            className="mt-3"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ブロックする理由（任意・例: 資格試験に集中するため）"
            aria-label="ブロックする理由"
          />
        </>
      )}
    </div>
  );
};
