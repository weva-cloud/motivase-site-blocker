// ブロックパターンの解析・マッチ判定・説明文生成（純粋関数のみ。chrome API 非依存）
import type { BlockRule, PatternType } from "./types";

/** パース済みパターン（BlockRule のうちマッチングに必要な部分） */
export interface ParsedPattern {
  type: PatternType;
  domain: string;
  path?: string;
}

export type ParseResult =
  | {
      ok: true;
      parsed: ParsedPattern;
      note?: string;
      /** www. 除去前の正確なホスト名（host 型パターンを組み立てる際に使う） */
      exactHost: string;
    }
  | { ok: false; error: string };

/** ホスト名として許容するか（ドットを含む / localhost / IPv4） */
function isValidHostname(host: string): boolean {
  if (host === "localhost") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(".") && !host.startsWith(".") && !host.endsWith(".");
}

/**
 * ユーザー入力（例: "youtube.com", "*.example.com", "x.com/home",
 * "https://news.example.jp/tech?tab=a"）をブロックパターンに解析する。
 */
export function parsePatternInput(input: string): ParseResult {
  let text = input.trim();
  if (text === "") {
    return { ok: false, error: "パターンを入力してください" };
  }
  if (/\s/.test(text)) {
    return { ok: false, error: "空白を含むパターンは登録できません" };
  }
  if (text.includes("#")) {
    return { ok: false, error: "「#」以降（ページ内リンク）は指定できません" };
  }

  // "*.example.com" 形式はサブドメイン込みの domain 指定として扱う
  let wildcard = false;
  if (text.startsWith("*.")) {
    wildcard = true;
    text = text.slice(2);
  } else if (text.includes("*")) {
    return {
      ok: false,
      error: "ワイルドカード「*」は先頭の「*.」のみ使えます",
    };
  }

  // スキーム補完（http/https 以外は拒否）
  if (text.includes("://")) {
    if (!/^https?:\/\//i.test(text)) {
      return { ok: false, error: "http / https のサイトのみ登録できます" };
    }
  } else {
    text = `https://${text}`;
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "URL として解釈できませんでした" };
  }

  const host = url.hostname.toLowerCase();
  if (host.includes("[")) {
    return { ok: false, error: "IPv6 アドレスは登録できません" };
  }
  if (!isValidHostname(host)) {
    return { ok: false, error: "ドメイン名が正しくありません" };
  }

  const rawPath = url.pathname.replace(/\/+$/, "").toLowerCase();
  const hasPath = rawPath !== "" && rawPath !== "/";
  let note: string | undefined;
  if (url.search !== "") {
    note = "クエリ（?以降）は無視され、パスの前方一致でブロックされます";
  }

  // "*.example.com/path" のようにワイルドカードとパスが併用されても、
  // prefix 型はもともとサブドメイン込みなのでそのまま prefix に落とせる
  void wildcard;

  if (hasPath) {
    return {
      ok: true,
      parsed: { type: "prefix", domain: stripWww(host), path: rawPath },
      note,
      exactHost: host,
    };
  }
  return {
    ok: true,
    parsed: { type: "domain", domain: stripWww(host) },
    note,
    exactHost: host,
  };
}

/** domain / prefix 型では www. をドメインの一部として扱わない */
function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** URL 文字列からホスト名（小文字）を取り出す。http(s) 以外は null */
export function hostnameOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** host が domain またはそのサブドメインか */
export function isDomainOrSubdomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * ルールが URL にマッチするかの純粋 TS 判定。
 * DNR 側（ruleToDnr）とセマンティクスを一致させること。
 * ライブプレビュー・popup の状態判定・一時許可失効時のタブ掃除に使う。
 */
export function matchesUrl(rule: ParsedPattern, url: string): boolean {
  const host = hostnameOf(url);
  if (host === null) return false;

  switch (rule.type) {
    case "domain":
      return isDomainOrSubdomain(host, rule.domain);
    case "host":
      return host === rule.domain;
    case "prefix": {
      if (!isDomainOrSubdomain(host, rule.domain)) return false;
      const path = new URL(url).pathname.toLowerCase();
      const prefix = rule.path ?? "/";
      return path === prefix || path.startsWith(`${prefix}/`);
    }
  }
}

/** URL にマッチする有効なルールを全て返す */
export function matchingRules(rules: BlockRule[], url: string): BlockRule[] {
  return rules.filter((r) => r.enabled && matchesUrl(r, url));
}

/**
 * 一時許可に使うドメインを決める。
 * マッチしたルールのうち最も広い（短い）ドメインを選ぶことで、
 * 許可中にサブドメイン間を移動しても再ブロックされないようにする。
 */
export function broadestAllowDomain(matched: BlockRule[]): string | null {
  if (matched.length === 0) return null;
  return matched.reduce((a, b) => (b.domain.length < a.domain.length ? b : a)).domain;
}

/** パターンの日本語説明文 */
export function explainPattern(p: ParsedPattern): string {
  switch (p.type) {
    case "domain":
      return `${p.domain} とそのサブドメインのすべてのページをブロックします`;
    case "host":
      return `${p.domain} のページのみブロックします（サブドメインは含みません）`;
    case "prefix":
      return `${p.domain}（サブドメイン含む）の ${p.path} 配下のページをブロックします`;
  }
}

/** ルールの表示用ラベル */
export function ruleLabel(p: ParsedPattern): string {
  return p.type === "prefix" ? `${p.domain}${p.path}` : p.domain;
}

/** プレビュー用のマッチ例 / 非マッチ例 URL */
export function exampleUrls(p: ParsedPattern): {
  matched: string[];
  unmatched: string[];
} {
  switch (p.type) {
    case "domain":
      return {
        matched: [
          `https://${p.domain}/`,
          `https://www.${p.domain}/watch`,
          `https://m.${p.domain}/feed`,
        ],
        unmatched: [`https://not-${p.domain}/`, `https://${p.domain}.evil.example/`],
      };
    case "host":
      return {
        matched: [`https://${p.domain}/`, `https://${p.domain}/any/page`],
        unmatched: [`https://sub.${p.domain}/`],
      };
    case "prefix":
      return {
        matched: [
          `https://${p.domain}${p.path}`,
          `https://${p.domain}${p.path}/child`,
          `https://sub.${p.domain}${p.path}?tab=1`,
        ],
        unmatched: [`https://${p.domain}/`, `https://${p.domain}${p.path}page`],
      };
  }
}

/** 同一パターンのルールがすでに存在するか */
export function findDuplicateRule(
  rules: BlockRule[],
  p: ParsedPattern,
): BlockRule | undefined {
  return rules.find(
    (r) =>
      r.type === p.type && r.domain === p.domain && (r.path ?? null) === (p.path ?? null),
  );
}
