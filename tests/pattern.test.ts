import { describe, expect, it } from "vitest";
import {
  broadestAllowDomain,
  explainPattern,
  findDuplicateRule,
  matchesUrl,
  parsePatternInput,
  ruleLabel,
} from "../lib/pattern";
import type { BlockRule } from "../lib/types";

function rule(
  partial: Partial<BlockRule> & Pick<BlockRule, "type" | "domain">,
): BlockRule {
  return {
    id: "test",
    dnrId: 1,
    enabled: true,
    createdAt: 0,
    timing: "always",
    ...partial,
  };
}

describe("parsePatternInput", () => {
  it.each([
    ["youtube.com", "domain", "youtube.com", undefined],
    ["*.youtube.com", "domain", "youtube.com", undefined],
    ["www.youtube.com", "domain", "youtube.com", undefined],
    ["YouTube.COM", "domain", "youtube.com", undefined],
    ["https://x.com", "domain", "x.com", undefined],
    ["x.com/home", "prefix", "x.com", "/home"],
    ["x.com/home/", "prefix", "x.com", "/home"],
    ["https://news.example.jp/Tech/AI", "prefix", "news.example.jp", "/tech/ai"],
    ["localhost", "domain", "localhost", undefined],
    ["192.168.1.1", "domain", "192.168.1.1", undefined],
  ])("%s → type=%s domain=%s path=%s", (input, type, domain, path) => {
    const result = parsePatternInput(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.type).toBe(type);
    expect(result.parsed.domain).toBe(domain);
    expect(result.parsed.path).toBe(path);
  });

  it("IDN を punycode に正規化する", () => {
    const result = parsePatternInput("日本語.jp");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.domain).toMatch(/^xn--/);
  });

  it("ポートは無視される", () => {
    const result = parsePatternInput("example.com:8080");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.domain).toBe("example.com");
  });

  it("クエリ付き入力は note を返しつつパスだけ採用する", () => {
    const result = parsePatternInput("example.com/watch?v=abc");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed).toEqual({
      type: "prefix",
      domain: "example.com",
      path: "/watch",
    });
    expect(result.note).toBeTruthy();
  });

  it.each([
    [""],
    ["   "],
    ["ftp://example.com"],
    ["example.com/#section"],
    ["ho st.com"],
    ["nodots"],
    ["foo.*.com"],
    ["http://[::1]/"],
  ])("不正入力 %j はエラー", (input) => {
    const result = parsePatternInput(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });
});

describe("matchesUrl", () => {
  const domainRule = rule({ type: "domain", domain: "youtube.com" });
  const hostRule = rule({ type: "host", domain: "www.chess.com" });
  const prefixRule = rule({ type: "prefix", domain: "x.com", path: "/home" });

  it.each([
    ["https://youtube.com/", true],
    ["https://www.youtube.com/watch?v=1", true],
    ["https://m.youtube.com/feed", true],
    ["HTTPS://YOUTUBE.COM/UPPER", true],
    ["http://youtube.com:8080/", true],
    ["https://notyoutube.com/", false],
    ["https://youtube.com.evil.com/", false],
    ["https://youtube.co/", false],
    ["ftp://youtube.com/", false],
    ["chrome://settings/", false],
    ["not a url", false],
  ])("domain ルール: %s → %s", (url, expected) => {
    expect(matchesUrl(domainRule, url)).toBe(expected);
  });

  it.each([
    ["https://www.chess.com/play", true],
    ["https://chess.com/", false],
    ["https://sub.www.chess.com/", false],
  ])("host ルール: %s → %s", (url, expected) => {
    expect(matchesUrl(hostRule, url)).toBe(expected);
  });

  it.each([
    ["https://x.com/home", true],
    ["https://x.com/home/", true],
    ["https://x.com/home/timeline", true],
    ["https://x.com/HOME?tab=1", true],
    ["https://mobile.x.com/home", true],
    ["https://x.com/homepage", false],
    ["https://x.com/", false],
    ["https://x.com/messages", false],
  ])("prefix ルール: %s → %s", (url, expected) => {
    expect(matchesUrl(prefixRule, url)).toBe(expected);
  });
});

describe("broadestAllowDomain", () => {
  it("最も広い（短い）ドメインを選ぶ", () => {
    const matched = [
      rule({ type: "domain", domain: "m.youtube.com" }),
      rule({ type: "domain", domain: "youtube.com" }),
    ];
    expect(broadestAllowDomain(matched)).toBe("youtube.com");
    expect(broadestAllowDomain([])).toBeNull();
  });
});

describe("explainPattern / ruleLabel / findDuplicateRule", () => {
  it("日本語の説明文を返す", () => {
    expect(explainPattern({ type: "domain", domain: "youtube.com" })).toContain(
      "サブドメイン",
    );
    expect(explainPattern({ type: "prefix", domain: "x.com", path: "/home" })).toContain(
      "/home",
    );
  });

  it("表示ラベル", () => {
    expect(ruleLabel({ type: "domain", domain: "youtube.com" })).toBe("youtube.com");
    expect(ruleLabel({ type: "prefix", domain: "x.com", path: "/home" })).toBe(
      "x.com/home",
    );
  });

  it("重複検出はパスまで比較する", () => {
    const rules = [rule({ type: "prefix", domain: "x.com", path: "/home" })];
    expect(
      findDuplicateRule(rules, { type: "prefix", domain: "x.com", path: "/home" }),
    ).toBeTruthy();
    expect(
      findDuplicateRule(rules, { type: "prefix", domain: "x.com", path: "/hom" }),
    ).toBeUndefined();
    expect(findDuplicateRule(rules, { type: "domain", domain: "x.com" })).toBeUndefined();
  });
});
