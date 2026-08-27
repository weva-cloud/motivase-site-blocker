// 型付きストレージ定義。全サーフェス（SW / popup / options / blocked）で共有する。
// - local:   永続データ（設定・やること・ポモドーロ・統計）
// - session: ブラウザを閉じると消えるデータ（一時許可）。DNR の session ルールと同寿命
//
// settings はスキーマ拡張に備え、読み出し時に必ず normalizeSettings を通す。
import { storage } from "wxt/utils/storage";
import { normalizeSettings } from "./normalize";
import type {
  AllowLogEntry,
  PomodoroState,
  Settings,
  Stats,
  TempAllow,
  TodoItem,
} from "./types";
import { DEFAULT_SETTINGS, EMPTY_STATS, IDLE_POMODORO } from "./types";

export const settingsItem = storage.defineItem<Settings>("local:settings", {
  fallback: DEFAULT_SETTINGS,
});

export const todosItem = storage.defineItem<TodoItem[]>("local:todos", {
  fallback: [],
});

export const pomodoroItem = storage.defineItem<PomodoroState>("local:pomodoro", {
  fallback: IDLE_POMODORO,
});

export const statsItem = storage.defineItem<Stats>("local:stats", {
  fallback: EMPTY_STATS,
});

/** 一時許可の履歴（新しい順、上限つき） */
export const allowLogItem = storage.defineItem<AllowLogEntry[]>("local:allowLog", {
  fallback: [],
});

/** 有効な一時許可（ドメイン → TempAllow） */
export const tempAllowsItem = storage.defineItem<Record<string, TempAllow>>(
  "session:tempAllows",
  { fallback: {} },
);

/** 一時許可用 DNR session ルールの ID 採番カウンタ */
export const nextAllowRuleIdItem = storage.defineItem<number>("session:nextAllowRuleId", {
  fallback: 1,
});

/** 正規化済みの settings を返す（フィールドが欠けているデータも安全に扱える） */
export async function getSettings(): Promise<Settings> {
  return normalizeSettings(await settingsItem.getValue());
}

/** settings の read-modify-write ヘルパー（入力は正規化済み） */
export async function updateSettings(fn: (s: Settings) => Settings): Promise<Settings> {
  const current = await getSettings();
  const next = fn(structuredClone(current));
  await settingsItem.setValue(next);
  return next;
}

export async function updateTodos(
  fn: (todos: TodoItem[]) => TodoItem[],
): Promise<TodoItem[]> {
  const current = await todosItem.getValue();
  const next = fn(structuredClone(current));
  await todosItem.setValue(next);
  return next;
}
