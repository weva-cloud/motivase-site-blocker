// ポモドーロの副作用（alarm スケジュール・通知・統計）を担う background 専用モジュール。
// 状態遷移そのものは lib/pomodoro.ts の純粋関数に委譲する。
import type { PomodoroCommand } from "./messages";
import { advancePhase, pausePomodoro, resetPomodoro, startPomodoro } from "./pomodoro";
import { calcStreak, dateKey, getDayStats } from "./stats";
import { recordPomodoro } from "./stats-sw";
import { getSettings, pomodoroItem, statsItem } from "./storage";
import { STR } from "./strings";
import type { PomodoroState } from "./types";

export const POMODORO_ALARM = "pomodoro";

async function applyState(state: PomodoroState): Promise<void> {
  await pomodoroItem.setValue(state);
  if (state.running && state.endsAt !== null) {
    chrome.alarms.create(POMODORO_ALARM, { when: state.endsAt });
  } else {
    await chrome.alarms.clear(POMODORO_ALARM);
  }
}

export async function handlePomodoroCommand(cmd: PomodoroCommand): Promise<void> {
  const [state, settings] = await Promise.all([pomodoroItem.getValue(), getSettings()]);
  const now = Date.now();
  switch (cmd) {
    case "start":
      await applyState(startPomodoro(state, settings, now));
      break;
    case "pause":
      await applyState(pausePomodoro(state, now));
      break;
    case "reset":
      await applyState(resetPomodoro(state));
      break;
    case "skip":
      // スキップは「完了」に数えない（ズル防止）
      await applyState(advancePhase(state, settings, now));
      break;
  }
}

/** フェーズ終了 alarm の処理（統計加算と通知はここでのみ行う） */
export async function onPomodoroAlarm(): Promise<void> {
  const [state, settings] = await Promise.all([pomodoroItem.getValue(), getSettings()]);
  if (!state.running || state.endsAt === null) return;
  if (state.endsAt > Date.now() + 1000) return; // 設定変更などで残った古い alarm

  const finishedPhase = state.phase;
  await applyState(advancePhase(state, settings, Date.now()));

  if (finishedPhase === "work") {
    await recordPomodoro();
  }

  if (settings.widgets.pomodoro.notify) {
    let message: string;
    if (finishedPhase === "work") {
      // 進捗と目標を添えて達成感を返す（正の強化）
      const stats = await statsItem.getValue();
      const today = getDayStats(stats, dateKey(new Date())).pomodoros;
      const streak = calcStreak(stats, settings.dailyPomodoroGoal, new Date());
      const goal = settings.dailyPomodoroGoal;
      const progress =
        today >= goal
          ? `今日 ${today} 個目 — 目標達成！${streak >= 2 ? ` 🔥${streak}日連続` : ""}`
          : `今日 ${today} / 目標 ${goal} 個`;
      message = `${STR.notifyWorkDone(settings.widgets.pomodoro.breakMin)}（🍅 ${progress}）`;
    } else {
      message = STR.notifyBreakDone;
    }
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("/icon/128.png"),
      title: STR.appName,
      message,
    });
  }
}
