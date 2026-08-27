import { useMemo } from "react";
import { normalizeSettings } from "@/lib/normalize";
import { settingsItem } from "@/lib/storage";
import type { Settings } from "@/lib/types";
import { useStorageItem } from "./useStorageItem";

/** 正規化済みの settings を購読する（フィールドが欠けているデータでも安全） */
export function useSettings(): Settings | undefined {
  const raw = useStorageItem(settingsItem);
  return useMemo(() => (raw === undefined ? undefined : normalizeSettings(raw)), [raw]);
}
