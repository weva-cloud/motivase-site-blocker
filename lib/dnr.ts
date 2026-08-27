// BlockRule → declarativeNetRequest ルールへの変換と差分計算（純粋関数のみ）
//
// 設計メモ:
// - regexFilter は「部分一致」なので、\0（マッチ全体）に元 URL を丸ごと入れるため
//   すべての正規表現が URL 全体を消費する形にしている。
// - リクエスト URL に「#」は決して含まれないため、`blocked.html#u=\0` の
//   フラグメント渡しなら元 URL 中の ? や & を壊さずに受け渡せる。
// - domain / prefix 型は requestDomains（Chrome 側の正規のサブドメイン判定）を
//   併用し、`youtube.com.evil.com` のようなホスト偽装を防ぐ。
import type { BlockRule } from "./types";

/** chrome.declarativeNetRequest.Rule と構造互換の最小型（テストを chrome 非依存にするため自前定義） */
export interface DnrRule {
  id: number;
  priority: number;
  action: {
    type: "redirect";
    redirect: { regexSubstitution: string };
  };
  condition: {
    regexFilter: string;
    requestDomains?: string[];
    resourceTypes: ["main_frame"];
    isUrlFilterCaseSensitive: boolean;
  };
}

/** 一時許可用の allow ルール（session ルールとして登録する） */
export interface DnrAllowRule {
  id: number;
  priority: number;
  action: { type: "allow" };
  condition: {
    requestDomains: string[];
    resourceTypes: ["main_frame"];
  };
}

/** ブロック（redirect）ルールの priority。allow はこれより大きくする */
export const BLOCK_RULE_PRIORITY = 1;
export const ALLOW_RULE_PRIORITY = 100;

/** 正規表現のメタ文字をエスケープ */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** ルールの regexFilter を生成する（テスト用に公開） */
export function regexFilterFor(
  rule: Pick<BlockRule, "type" | "domain" | "path">,
): string {
  switch (rule.type) {
    case "domain":
      // ホスト判定は requestDomains に任せ、regex は URL 全体の捕捉のみ担う
      return "^https?://.*";
    case "host":
      // userinfo（user@）とポートを許容しつつ、ホスト名の直後がパス/クエリ/終端で
      // あることを強制して suffix 偽装を防ぐ
      return `^https?://(?:[^/@]*@)?${escapeRegex(rule.domain)}(?::\\d+)?(?:[/?].*)?$`;
    case "prefix":
      // ホスト判定は requestDomains に任せる。パスは前方一致だが
      // 「/home」が「/homepage」にマッチしない境界（次が / ? か終端）を保証する
      return `^https?://[^/]+${escapeRegex(rule.path ?? "/")}(?:[/?].*)?$`;
  }
}

/**
 * BlockRule → DNR redirect ルール。
 * blockedBaseUrl は chrome.runtime.getURL('/blocked.html') を呼び出し側で渡す。
 */
export function ruleToDnr(rule: BlockRule, blockedBaseUrl: string): DnrRule {
  const condition: DnrRule["condition"] = {
    regexFilter: regexFilterFor(rule),
    resourceTypes: ["main_frame"],
    isUrlFilterCaseSensitive: false,
  };
  if (rule.type === "domain" || rule.type === "prefix") {
    condition.requestDomains = [rule.domain];
  }
  return {
    id: rule.dnrId,
    priority: BLOCK_RULE_PRIORITY,
    action: {
      type: "redirect",
      // "\\0" はマッチ全体（= 元 URL）への置換。'\0' (NUL 文字) と書かないこと
      redirect: { regexSubstitution: `${blockedBaseUrl}#u=\\0` },
    },
    condition,
  };
}

/** 一時許可用 allow ルール。requestDomains 判定なので regex 枠を消費しない */
export function allowRuleFor(id: number, domain: string): DnrAllowRule {
  return {
    id,
    priority: ALLOW_RULE_PRIORITY,
    action: { type: "allow" },
    condition: {
      requestDomains: [domain],
      resourceTypes: ["main_frame"],
    },
  };
}

/** 比較用の正規化キー（Chrome が返すルールとフィールド順が違っても比較できるように） */
function canonicalKey(rule: DnrRule): string {
  return JSON.stringify({
    id: rule.id,
    priority: rule.priority,
    actionType: rule.action.type,
    regexSubstitution: rule.action.redirect?.regexSubstitution ?? null,
    regexFilter: rule.condition.regexFilter ?? null,
    requestDomains: [...(rule.condition.requestDomains ?? [])].sort(),
    resourceTypes: [...(rule.condition.resourceTypes ?? [])].sort(),
    isUrlFilterCaseSensitive: rule.condition.isUrlFilterCaseSensitive ?? false,
  });
}

export interface DnrDiff {
  removeRuleIds: number[];
  addRules: DnrRule[];
}

/**
 * 現在の動的ルールとあるべきルールの差分を計算する。
 * 変更されたルールは remove + add の両方に入る（updateDynamicRules は remove が先に適用される）。
 */
export function computeDiff(current: DnrRule[], desired: DnrRule[]): DnrDiff {
  const currentById = new Map(current.map((r) => [r.id, r]));
  const desiredById = new Map(desired.map((r) => [r.id, r]));

  const removeRuleIds: number[] = [];
  const addRules: DnrRule[] = [];

  for (const [id, cur] of currentById) {
    const want = desiredById.get(id);
    if (want === undefined) {
      removeRuleIds.push(id);
    } else if (canonicalKey(cur) !== canonicalKey(want)) {
      removeRuleIds.push(id);
      addRules.push(want);
    }
  }
  for (const [id, want] of desiredById) {
    if (!currentById.has(id)) addRules.push(want);
  }
  return { removeRuleIds, addRules };
}
