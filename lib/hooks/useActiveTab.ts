import { useEffect, useState } from "react";

/**
 * popup 用: アクティブタブを取得する。
 * undefined = ロード中、null = 取得できなかった。
 * tab.url は host_permissions が及ぶページ（http/https）でのみ入る。
 */
export function useActiveTab(): chrome.tabs.Tab | null | undefined {
  const [tab, setTab] = useState<chrome.tabs.Tab | null | undefined>(undefined);

  useEffect(() => {
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => setTab(tabs[0] ?? null));
  }, []);

  return tab;
}
