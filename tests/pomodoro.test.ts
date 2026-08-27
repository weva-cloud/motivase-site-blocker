import { describe, expect, it } from "vitest";
import {
  advancePhase,
  pausePomodoro,
  remainingMs,
  resetPomodoro,
  startPomodoro,
} from "../lib/pomodoro";
import { DEFAULT_SETTINGS, IDLE_POMODORO } from "../lib/types";

const NOW = 1_000_000;

describe("pomodoro 状態遷移", () => {
  it("開始 → work 25分", () => {
    const s = startPomodoro(IDLE_POMODORO, DEFAULT_SETTINGS, NOW);
    expect(s.phase).toBe("work");
    expect(s.running).toBe(true);
    expect(s.endsAt).toBe(NOW + 25 * 60_000);
    expect(remainingMs(s, NOW + 60_000)).toBe(24 * 60_000);
  });

  it("一時停止 → 残り時間が凍結される → 再開で引き継ぐ", () => {
    const started = startPomodoro(IDLE_POMODORO, DEFAULT_SETTINGS, NOW);
    const paused = pausePomodoro(started, NOW + 5 * 60_000);
    expect(paused.running).toBe(false);
    expect(paused.remainingMs).toBe(20 * 60_000);
    expect(remainingMs(paused, NOW + 999 * 60_000)).toBe(20 * 60_000);

    const resumed = startPomodoro(paused, DEFAULT_SETTINGS, NOW + 10 * 60_000);
    expect(resumed.running).toBe(true);
    expect(resumed.endsAt).toBe(NOW + 30 * 60_000);
  });

  it("work 完了 → break（サイクル加算）→ break 完了 → work", () => {
    const work = startPomodoro(IDLE_POMODORO, DEFAULT_SETTINGS, NOW);
    const brk = advancePhase(work, DEFAULT_SETTINGS, NOW + 25 * 60_000);
    expect(brk.phase).toBe("break");
    expect(brk.cyclesCompleted).toBe(1);
    expect(brk.endsAt).toBe(NOW + 30 * 60_000);

    const work2 = advancePhase(brk, DEFAULT_SETTINGS, NOW + 30 * 60_000);
    expect(work2.phase).toBe("work");
    expect(work2.cyclesCompleted).toBe(1);
  });

  it("リセットで idle に戻る（サイクル数は保持）", () => {
    const work = startPomodoro(IDLE_POMODORO, DEFAULT_SETTINGS, NOW);
    const brk = advancePhase(work, DEFAULT_SETTINGS, NOW);
    const reset = resetPomodoro(brk);
    expect(reset.phase).toBe("idle");
    expect(reset.cyclesCompleted).toBe(1);
    expect(remainingMs(reset, NOW)).toBeNull();
  });

  it("idle の pause / advance は無視される", () => {
    expect(pausePomodoro(IDLE_POMODORO, NOW)).toBe(IDLE_POMODORO);
    expect(advancePhase(IDLE_POMODORO, DEFAULT_SETTINGS, NOW)).toBe(IDLE_POMODORO);
  });
});
