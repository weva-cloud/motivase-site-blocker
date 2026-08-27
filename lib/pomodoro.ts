// ポモドーロタイマーの純粋な状態遷移ロジック。
// タイマーの実体は「endsAt (epoch ms) を storage に置き、残り時間は now から計算」
// という方式なので、SW が再起動してもページをリロードしても狂わない。
// alarm のスケジュールや通知などの副作用は background 側（pomodoro-sw.ts）が担う。
import type { PomodoroState, Settings } from "./types";
import { IDLE_POMODORO } from "./types";

/** 現在の残り時間（ms）。idle のときは null */
export function remainingMs(state: PomodoroState, now: number): number | null {
  if (state.phase === "idle") return null;
  if (state.running && state.endsAt !== null) {
    return Math.max(0, state.endsAt - now);
  }
  return state.remainingMs ?? 0;
}

/** 開始 / 再開 */
export function startPomodoro(
  state: PomodoroState,
  settings: Settings,
  now: number,
): PomodoroState {
  if (state.phase !== "idle" && !state.running && state.remainingMs !== null) {
    // 一時停止からの再開
    return {
      ...state,
      running: true,
      endsAt: now + state.remainingMs,
      remainingMs: null,
    };
  }
  if (state.phase === "idle") {
    return {
      ...state,
      phase: "work",
      running: true,
      endsAt: now + settings.widgets.pomodoro.workMin * 60_000,
      remainingMs: null,
    };
  }
  return state; // すでに実行中なら何もしない
}

export function pausePomodoro(state: PomodoroState, now: number): PomodoroState {
  if (!state.running || state.endsAt === null) return state;
  return {
    ...state,
    running: false,
    endsAt: null,
    remainingMs: Math.max(0, state.endsAt - now),
  };
}

export function resetPomodoro(state: PomodoroState): PomodoroState {
  return { ...IDLE_POMODORO, cyclesCompleted: state.cyclesCompleted };
}

/**
 * フェーズ完了（alarm 発火またはスキップ）時の遷移。
 * work → break、break → work（次のポモドーロを自動開始）
 */
export function advancePhase(
  state: PomodoroState,
  settings: Settings,
  now: number,
): PomodoroState {
  if (state.phase === "idle") return state;
  const { workMin, breakMin } = settings.widgets.pomodoro;
  if (state.phase === "work") {
    return {
      phase: "break",
      running: true,
      endsAt: now + breakMin * 60_000,
      remainingMs: null,
      cyclesCompleted: state.cyclesCompleted + 1,
    };
  }
  return {
    phase: "work",
    running: true,
    endsAt: now + workMin * 60_000,
    remainingMs: null,
    cyclesCompleted: state.cyclesCompleted,
  };
}
