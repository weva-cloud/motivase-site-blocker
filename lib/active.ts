// 「いまこの瞬間に効いているルール」の判定。
// DNR 同期（background）と UI の表示判定の両方がこれを使うことで
// セマンティクスのズレを防ぐ。
import { isScheduleActive } from "./schedule";
import type { BlockRule, PomodoroState, Settings } from "./types";

/** フォーカスロック中か（作業フェーズ中は一時許可も禁止） */
export function isFocusLock(settings: Settings, pomodoro: PomodoroState): boolean {
  return (
    settings.widgets.pomodoro.focusMode && pomodoro.phase === "work" && pomodoro.running
  );
}

/** ルールが now 時点で効いているか */
export function isRuleActiveAt(
  rule: BlockRule,
  settings: Settings,
  pomodoro: PomodoroState,
  now: number,
): boolean {
  if (!rule.enabled) return false;
  if (rule.timing === "always") return true;
  // スケジュール型: 時間帯内、またはフォーカスモードの作業中
  return (
    isScheduleActive(settings.schedule, new Date(now)) || isFocusLock(settings, pomodoro)
  );
}

/** now 時点で効いているルールの一覧 */
export function activeRules(
  settings: Settings,
  pomodoro: PomodoroState,
  now: number,
): BlockRule[] {
  return settings.rules.filter((r) => isRuleActiveAt(r, settings, pomodoro, now));
}
