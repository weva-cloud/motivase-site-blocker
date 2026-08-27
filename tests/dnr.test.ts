import { describe, expect, it } from "vitest";
import {
  ALLOW_RULE_PRIORITY,
  allowRuleFor,
  BLOCK_RULE_PRIORITY,
  computeDiff,
  type DnrRule,
  regexFilterFor,
  ruleToDnr,
} from "../lib/dnr";
import type { BlockRule } from "../lib/types";

const BLOCKED = "chrome-extension://abc/blocked.html";

function rule(
  partial: Partial<BlockRule> & Pick<BlockRule, "type" | "domain">,
): BlockRule {
  return { id: "t", dnrId: 1, enabled: true, createdAt: 0, timing: "always", ...partial };
}

/**
 * 生成された regexFilter を JS の RegExp として実行して挙動を検証する。
 * 使用している構文は RE2 互換のもののみ（後方参照・lookaround なし）なので
 * JS RegExp での検証結果が Chrome（RE2）と一致する。
 * DNR の isUrlFilterCaseSensitive:false 相当として "i" フラグを付ける。
 */
function execFilter(filter: string, url: string): RegExpMatchArray | null {
  return url.match(new RegExp(filter, "i"));
}

describe("ruleToDnr", () => {
  it("domain 型: requestDomains + 全消費 regex", () => {
    const dnr = ruleToDnr(
      rule({ type: "domain", domain: "youtube.com", dnrId: 7 }),
      BLOCKED,
    );
    expect(dnr).toEqual({
      id: 7,
      priority: BLOCK_RULE_PRIORITY,
      action: {
        type: "redirect",
        redirect: { regexSubstitution: `${BLOCKED}#u=\\0` },
      },
      condition: {
        regexFilter: "^https?://.*",
        requestDomains: ["youtube.com"],
        resourceTypes: ["main_frame"],
        isUrlFilterCaseSensitive: false,
      },
    });
  });

  it("host 型は requestDomains を持たない", () => {
    const dnr = ruleToDnr(rule({ type: "host", domain: "www.chess.com" }), BLOCKED);
    expect(dnr.condition.requestDomains).toBeUndefined();
  });

  it("prefix 型は requestDomains + パス境界付き regex", () => {
    const dnr = ruleToDnr(
      rule({ type: "prefix", domain: "x.com", path: "/home" }),
      BLOCKED,
    );
    expect(dnr.condition.requestDomains).toEqual(["x.com"]);
    expect(dnr.condition.regexFilter).toContain("/home");
  });

  it("regexSubstitution は文字どおりの \\0（NUL 文字ではない）で終わる", () => {
    const dnr = ruleToDnr(rule({ type: "domain", domain: "a.com" }), BLOCKED);
    const sub = dnr.action.redirect.regexSubstitution;
    expect(sub.endsWith("#u=\\0")).toBe(true);
    expect(sub).not.toContain("\u0000");
    // 「\」と「0」の 2 文字であること
    expect(sub.slice(-2)).toBe("\\0");
  });
});

describe("regexFilterFor — 生成 regex の挙動検証", () => {
  it("domain 型: どの http(s) URL でも全体を消費する（\\0 の切り詰め防止）", () => {
    const filter = regexFilterFor({ type: "domain", domain: "youtube.com" });
    const url = "https://www.youtube.com/watch?v=abc&t=10";
    const m = execFilter(filter, url);
    expect(m).not.toBeNull();
    expect(m?.[0]).toBe(url);
  });

  it.each([
    ["https://www.chess.com/", true],
    ["https://www.chess.com/play/online", true],
    ["https://www.chess.com?ref=1", true],
    ["http://www.chess.com:8080/x", true],
    ["https://user@www.chess.com/x", true],
    ["https://www.chess.com.evil.com/", false],
    ["https://sub.www.chess.com/", false],
    ["https://wwwXchess.com/", false],
  ])("host 型: %s → match=%s", (url, expected) => {
    const filter = regexFilterFor({ type: "host", domain: "www.chess.com" });
    const m = execFilter(filter, url);
    expect(m !== null).toBe(expected);
    if (m !== null) expect(m[0]).toBe(url);
  });

  it.each([
    ["https://x.com/home", true],
    ["https://x.com/home/timeline", true],
    ["https://x.com/home?tab=1", true],
    ["https://mobile.x.com/home", true],
    ["https://x.com/homepage", false],
    ["https://x.com/", false],
  ])("prefix 型: %s → match=%s", (url, expected) => {
    const filter = regexFilterFor({ type: "prefix", domain: "x.com", path: "/home" });
    const m = execFilter(filter, url);
    expect(m !== null).toBe(expected);
    if (m !== null) expect(m[0]).toBe(url);
  });

  it("パスの正規表現メタ文字はエスケープされる", () => {
    const filter = regexFilterFor({
      type: "prefix",
      domain: "example.com",
      path: "/a+b(c)",
    });
    expect(execFilter(filter, "https://example.com/a+b(c)")).not.toBeNull();
    expect(execFilter(filter, "https://example.com/aab(c)")).toBeNull();
  });
});

describe("allowRuleFor", () => {
  it("requestDomains 判定の allow ルール（redirect より高い priority）", () => {
    const allow = allowRuleFor(3, "youtube.com");
    expect(allow.priority).toBe(ALLOW_RULE_PRIORITY);
    expect(allow.priority).toBeGreaterThan(BLOCK_RULE_PRIORITY);
    expect(allow.action.type).toBe("allow");
    expect(allow.condition.requestDomains).toEqual(["youtube.com"]);
  });
});

describe("computeDiff", () => {
  const a = ruleToDnr(rule({ type: "domain", domain: "a.com", dnrId: 1 }), BLOCKED);
  const b = ruleToDnr(rule({ type: "domain", domain: "b.com", dnrId: 2 }), BLOCKED);

  it("追加", () => {
    expect(computeDiff([], [a, b])).toEqual({ removeRuleIds: [], addRules: [a, b] });
  });

  it("削除", () => {
    expect(computeDiff([a, b], [a])).toEqual({ removeRuleIds: [2], addRules: [] });
  });

  it("変更は remove + add の両方に入る", () => {
    const b2 = ruleToDnr(
      rule({ type: "prefix", domain: "b.com", path: "/feed", dnrId: 2 }),
      BLOCKED,
    );
    expect(computeDiff([a, b], [a, b2])).toEqual({
      removeRuleIds: [2],
      addRules: [b2],
    });
  });

  it("差分なしなら何もしない（フィールド順が違っても同一とみなす）", () => {
    const shuffled = JSON.parse(JSON.stringify([b, a])) as DnrRule[];
    expect(computeDiff(shuffled, [a, b])).toEqual({ removeRuleIds: [], addRules: [] });
  });
});
