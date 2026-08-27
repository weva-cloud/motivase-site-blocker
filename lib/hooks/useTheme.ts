import { useEffect } from "react";
import { resolveTheme } from "@/lib/theme";
import { applyResolvedTheme, prefersDark, writeThemeMirror } from "@/lib/theme-dom";
import type { ThemePref } from "@/lib/types";

/**
 * settings のテーマ設定を <html data-theme> に同期する。
 * auto のときは OS 設定の変化にも追従する。
 * pref が undefined（settings ロード中）の間は bootstrap の値を維持する。
 */
export function useTheme(pref: ThemePref | undefined): void {
  useEffect(() => {
    if (pref === undefined) return;
    writeThemeMirror(pref);
    const apply = () => applyResolvedTheme(resolveTheme(pref, prefersDark()));
    apply();
    if (pref !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [pref]);
}
