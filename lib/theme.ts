// 配色テーマの純粋ロジック（chrome API・DOM 非依存なのでテストにモックが要らない）。
// DOM への適用は lib/theme-dom.ts、React からの同期は lib/hooks/useTheme.ts が担う。
import type { ThemePref } from "./types";

/** 実際に適用される配色（auto を解決したあとの値） */
export type ResolvedTheme = "light" | "dark";

/** data-theme 属性を描画前に決めるための localStorage ミラーのキー */
export const THEME_MIRROR_KEY = "msb:theme";

export function isThemePref(v: unknown): v is ThemePref {
  return v === "auto" || v === "light" || v === "dark";
}

/** テーマ設定と OS の設定から、実際に適用する配色を決める */
export function resolveTheme(pref: ThemePref, prefersDark: boolean): ResolvedTheme {
  if (pref === "auto") return prefersDark ? "dark" : "light";
  return pref;
}
