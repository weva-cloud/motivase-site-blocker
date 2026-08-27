import { useState } from "react";
import { PatternTypeBadge } from "@/components/ui/Badge";
import { Favicon } from "@/components/ui/Favicon";
import { TextField } from "@/components/ui/TextField";
import {
  exampleUrls,
  explainPattern,
  matchesUrl,
  type ParsedPattern,
  ruleLabel,
} from "@/lib/pattern";

interface Props {
  pattern: ParsedPattern;
  note?: string;
  /** domain 型のとき「サブドメインも含める」トグルを出す */
  subdomainToggle?: { value: boolean; onChange: (v: boolean) => void };
}

/** 追加前にどんな URL がブロックされるかを可視化するプレビュー */
export const PatternPreview = ({ pattern, note, subdomainToggle }: Props) => {
  const [testUrl, setTestUrl] = useState("");
  const examples = exampleUrls(pattern);

  const normalizedTest =
    testUrl.trim() === ""
      ? null
      : testUrl.includes("://")
        ? testUrl.trim()
        : `https://${testUrl.trim()}`;
  const testResult = normalizedTest !== null ? matchesUrl(pattern, normalizedTest) : null;

  return (
    <div className="sunken mt-4 rounded-lg p-4">
      <div className="flex items-center gap-2.5">
        <Favicon domain={pattern.domain} size={22} />
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">
          {ruleLabel(pattern)}
        </span>
        <PatternTypeBadge type={pattern.type} />
      </div>
      <p className="mt-2 text-sm">{explainPattern(pattern)}</p>
      {note !== undefined && <p className="mt-1 text-xs text-muted">※ {note}</p>}

      {subdomainToggle !== undefined && (
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={subdomainToggle.value}
            onChange={(e) => subdomainToggle.onChange(e.target.checked)}
            className="size-4 accent-amber-500"
          />
          サブドメインも含める
        </label>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] text-muted">ブロックされる例</div>
          <ul className="space-y-0.5">
            {examples.matched.map((url) => (
              <li
                key={url}
                className="truncate font-mono text-xs text-emerald-600 dark:text-emerald-400"
              >
                {url}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-muted">ブロックされない例</div>
          <ul className="space-y-0.5">
            {examples.unmatched.map((url) => (
              <li
                key={url}
                className="truncate font-mono text-xs text-muted line-through"
              >
                {url}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3">
        <TextField
          value={testUrl}
          onChange={(e) => setTestUrl(e.target.value)}
          placeholder="URL を入力してテスト（例: https://www.youtube.com/watch）"
          aria-label="URL をテスト"
        />
        {testResult !== null && (
          <p
            className={`mt-1.5 text-xs font-medium ${
              testResult ? "text-emerald-600 dark:text-emerald-400" : "text-muted"
            }`}
          >
            {testResult ? "この URL はブロックされます" : "この URL はブロックされません"}
          </p>
        )}
      </div>
    </div>
  );
};
