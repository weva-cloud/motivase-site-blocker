import { useEffect, useState } from "react";

/** wxt/utils/storage の defineItem が返すアイテムの最小インターフェース */
interface StorageItemLike<T> {
  getValue(): Promise<T>;
  watch(cb: (newValue: T, oldValue: T | null) => void): () => void;
}

/**
 * ストレージアイテムを React state として購読する。
 * 初回ロードが終わるまでは undefined を返す。
 * 他のタブ / サーフェスでの変更も watch 経由で反映される。
 */
export function useStorageItem<T>(item: StorageItemLike<T>): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    const load = () =>
      void item.getValue().then((v) => {
        if (mounted) setValue(v);
      });
    load();
    // watch のコールバック引数に頼らず getValue で読み直す
    // （fallback の解決を defineItem 側に一元化するため）
    const unwatch = item.watch(load);
    return () => {
      mounted = false;
      unwatch();
    };
  }, [item]);

  return value;
}
