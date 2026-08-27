import { describe, expect, it } from "vitest";
import { activeRules, isFocusLock, isRuleActiveAt } from "../lib/active";
import type { BlockRule, PomodoroState, Settings } from "../lib/types";
import { DEFAULT_SETTINGS, IDLE_POMODORO } from "../lib/types";

function rule(partial: Partial<BlockRule>): BlockRule {
  return {
    id: "r",
    dnrId: 1,
    type: "domain",
    domain: "x.com",
    enabled: true,
    createdAt: 0,
    timing: "always",
    ...partial,
  };
}

// 平日 9-18 のデフォルトスケジュール。2026-07-13(月) を基準にする
const MON_NOON = new Date(2026, 6, 13, 12, 0).getTime();
const MON_NIGHT = new Date(2026, 6, 13, 20, 0).getTime();

const WORKING: PomodoroState = {
  phase: "work",
  running: true,
  endsAt: MON_NOON + 10_000,
  remainingMs: null,
  cyclesCompleted: 0,
};

function settingsWith(rules: BlockRule[], focusMode = true): Settings {
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    rules,
    widgets: {
      ...structuredClone(DEFAULT_SETTINGS.widgets),
      pomodoro: { ...DEFAULT_SETTINGS.widgets.pomodoro, focusMode },
    },
  };
}

describe("isRuleActiveAt / activeRules", () => {
  it("always ルールは常に有効", () => {
    const s = settingsWith([rule({})]);
    expect(isRuleActiveAt(s.rules[0], s, IDLE_POMODORO, MON_NIGHT)).toBe(true);
  });

  it("無効化されたルールは常に無効", () => {
    const s = settingsWith([rule({ enabled: false })]);
    expect(isRuleActiveAt(s.rules[0], s, IDLE_POMODORO, MON_NOON)).toBe(false);
  });

  it("schedule ルールは時間帯内のみ有効", () => {
    const s = settingsWith([rule({ timing: "schedule" })]);
    expect(isRuleActiveAt(s.rules[0], s, IDLE_POMODORO, MON_NOON)).toBe(true);
    expect(isRuleActiveAt(s.rules[0], s, IDLE_POMODORO, MON_NIGHT)).toBe(false);
  });

  it("フォーカスモードの作業中はスケジュール外でも有効", () => {
    const s = settingsWith([rule({ timing: "schedule" })]);
    expect(isRuleActiveAt(s.rules[0], s, WORKING, MON_NIGHT)).toBe(true);
    // focusMode OFF なら時間帯外は無効のまま
    const off = settingsWith([rule({ timing: "schedule" })], false);
    expect(isRuleActiveAt(off.rules[0], off, WORKING, MON_NIGHT)).toBe(false);
  });

  it("activeRules はフィルタ結果を返す", () => {
    const s = settingsWith([
      rule({ id: "a", timing: "always" }),
      rule({ id: "b", timing: "schedule" }),
      rule({ id: "c", enabled: false }),
    ]);
    expect(activeRules(s, IDLE_POMODORO, MON_NIGHT).map((r) => r.id)).toEqual(["a"]);
    expect(activeRules(s, IDLE_POMODORO, MON_NOON).map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("isFocusLock", () => {
  it("focusMode ON + 作業中のみロック", () => {
    const s = settingsWith([]);
    expect(isFocusLock(s, WORKING)).toBe(true);
    expect(isFocusLock(s, IDLE_POMODORO)).toBe(false);
    expect(isFocusLock(s, { ...WORKING, running: false })).toBe(false);
    expect(isFocusLock(s, { ...WORKING, phase: "break" })).toBe(false);
    const off = settingsWith([], false);
    expect(isFocusLock(off, WORKING)).toBe(false);
  });
});
