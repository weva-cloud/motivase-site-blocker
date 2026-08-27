// テーマを DOM に適用する層（document / localStorage を触る）。
// storage.local は非同期なので、描画前の一瞬だけ localStorage のミラーを使って
// data-theme を確定させ、テーマが切り替わる「閃き」を防ぐ。
import { isThemePref, type ResolvedTheme, resolveTheme, THEME_MIRROR_KEY } from "./theme";
import type { ThemePref } from "./types";

export function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
}

/** localStorage は拡張ページごとに独立。読めなくても致命的ではないので握りつぶす */
export function readThemeMirror(): ThemePref {
  try {
    const raw = localStorage.getItem(THEME_MIRROR_KEY);
    return isThemePref(raw) ? raw : "auto";
  } catch {
    return "auto";
  }
}

export function writeThemeMirror(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_MIRROR_KEY, pref);
  } catch {
    // プライベートモード等で書けなくても、settings が正なので実害はない
  }
}

/** React の描画前に呼ぶ。前回のテーマ設定を即座に反映する */
export function bootstrapTheme(): void {
  applyResolvedTheme(resolveTheme(readThemeMirror(), prefersDark()));
}
