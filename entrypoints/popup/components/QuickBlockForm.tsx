import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Favicon } from "@/components/ui/Favicon";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { regexFilterFor } from "@/lib/dnr";
import { sendToBackground } from "@/lib/messages";
import {
  findDuplicateRule,
  type ParsedPattern,
  parsePatternInput,
  ruleLabel,
} from "@/lib/pattern";
import { updateSettings } from "@/lib/storage";
import { STR } from "@/lib/strings";
import { MAX_RULES, type Settings } from "@/lib/types";

interface ScopeOption {
  pattern: ParsedPattern;
  label: string;
  hint: string;
}

interface Props {
  tab: chrome.tabs.Tab | null;
  url: string;
  host: string;
  settings: Settings;
}

/** ワンクリックでブロックルールを追加するフォーム（popup のメイン機能） */
export const QuickBlockForm = ({ tab, url, host, settings }: Props) => {
  const [selected, setSelected] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = useMemo((): ScopeOption[] => {
    const parsed = parsePatternInput(host);
    if (!parsed.ok) return [];
    const domain = parsed.parsed.domain;

    const result: ScopeOption[] = [
      {
        pattern: { type: "domain", domain },
        label: STR.scopeDomain,
        hint: STR.scopeDomainHint,
      },
      {
        pattern: { type: "host", domain: host },
        label: STR.scopeHost,
        hint: STR.scopeHostHint,
      },
    ];

    const pathname = new URL(url).pathname.replace(/\/+$/, "").toLowerCase();
    if (pathname !== "" && pathname !== "/") {
      result.push({
        pattern: { type: "prefix", domain, path: pathname },
        label: STR.scopePrefix,
        hint: STR.scopePrefixHint,
      });
    }
    return result;
  }, [host, url]);

  if (options.length === 0) {
    return (
      <div className="card p-5 text-center">
        <p className="text-sm font-medium">{STR.notBlockable}</p>
      </div>
    );
  }

  const block = async () => {
    const option = options[selected] ?? options[0];
    setBusy(true);
    setError(null);

    if (settings.rules.length >= MAX_RULES) {
      setError(STR.errRuleLimit);
      setBusy(false);
      return;
    }
    if (findDuplicateRule(settings.rules, option.pattern) !== undefined) {
      setError(STR.errDuplicateRule);
      setBusy(false);
      return;
    }
    const { isSupported } = await chrome.declarativeNetRequest.isRegexSupported({
      regex: regexFilterFor(option.pattern),
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
          timing: "always" as const,
          ...(trimmedReason !== "" ? { reason: trimmedReason } : {}),
          ...option.pattern,
        },
      ],
      nextDnrId: s.nextDnrId + 1,
    }));
    // 同期の完了を待つ。その中の sweepBlockedTabs() が、開いているこのタブを
    // ブロック画面へ送り返す（リロードは不要）
    await sendToBackground({ type: "RESYNC" });
    window.close();
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <Favicon domain={host} src={tab?.favIconUrl} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{host}</span>
      </div>

      {/* fieldset は既定で min-inline-size: min-content。長いパスに押し広げられて
          popup の幅を突き破るため min-w-0 で縮められるようにする */}
      <fieldset className="mb-4 min-w-0 space-y-2">
        <legend className="mb-2 text-xs text-muted">ブロックする範囲</legend>
        {options.map((option, i) => (
          <label
            key={option.label}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
              selected === i
                ? "border-accent-500/70 bg-accent-500/[0.07]"
                : "hairline hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
            }`}
          >
            <input
              type="radio"
              name="scope"
              checked={selected === i}
              onChange={() => setSelected(i)}
              className="mt-0.5 accent-amber-500"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                {option.label}
                <span className="ml-1.5 font-normal text-muted">{option.hint}</span>
              </span>
              <span className="mt-0.5 block truncate font-mono text-xs text-muted">
                {ruleLabel(option.pattern)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <TextField
        className="mb-3"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="ブロックする理由（任意・ブロック画面に表示）"
        aria-label="ブロックする理由"
      />

      {error !== null && <p className="mb-3 text-xs text-red-500">{error}</p>}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => void block()}
      >
        <Icon name="ban" size={16} />
        {STR.blockThisSite}
      </Button>
    </div>
  );
};
