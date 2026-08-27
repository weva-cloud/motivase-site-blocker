import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../lib/normalize";
import { DEFAULT_SETTINGS } from "../lib/types";

describe("normalizeSettings", () => {
  it("後から追加したフィールドを持たないデータをデフォルトで補完する", () => {
    const v1 = {
      rules: [
        {
          id: "r1",
          dnrId: 1,
          type: "domain",
          domain: "youtube.com",
          enabled: true,
          createdAt: 1,
        },
      ],
      nextDnrId: 2,
      allowDurations: [10, 60],
      widgets: {
        motivation: { enabled: true, messages: ["集中"] },
        todo: { enabled: true },
        pomodoro: { enabled: true, workMin: 25, breakMin: 5, notify: true },
      },
    };
    const s = normalizeSettings(v1);
    expect(s.rules[0].timing).toBe("always");
    expect(s.schedule).toEqual(DEFAULT_SETTINGS.schedule);
    expect(s.friction).toEqual(DEFAULT_SETTINGS.friction);
    expect(s.tempAllowBudgetMin).toBeNull();
    expect(s.strictMode).toBe(false);
    expect(s.widgets.pomodoro.focusMode).toBe(true);
    expect(s.widgets.pomodoro.sound).toBe(true);
    expect(s.allowDurations).toEqual([10, 60]);
    expect(s.widgets.motivation.messages).toEqual(["集中"]);
  });

  it("完全に空でもデフォルト設定になる", () => {
    const s = normalizeSettings(undefined);
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it("dnrId の重複・欠損を振り直す", () => {
    const s = normalizeSettings({
      rules: [
        { type: "domain", domain: "a.com", dnrId: 5 },
        { type: "domain", domain: "b.com", dnrId: 5 }, // 重複
        { type: "domain", domain: "c.com" }, // 欠損
      ],
    });
    const ids = s.rules.map((r) => r.dnrId);
    expect(new Set(ids).size).toBe(3);
    expect(s.nextDnrId).toBeGreaterThan(Math.max(...ids));
  });

  it("不正な値をクランプする", () => {
    const s = normalizeSettings({
      friction: { waitSec: 9999, requireReason: "yes" },
      dailyPomodoroGoal: -3,
      tempAllowBudgetMin: 100000,
      schedule: { days: [true], startMin: -10, endMin: 99999 },
    });
    expect(s.friction.waitSec).toBe(120);
    expect(s.friction.requireReason).toBe(DEFAULT_SETTINGS.friction.requireReason);
    expect(s.dailyPomodoroGoal).toBe(1);
    expect(s.tempAllowBudgetMin).toBe(24 * 60);
    expect(s.schedule.days).toHaveLength(7);
    expect(s.schedule.startMin).toBe(0);
    expect(s.schedule.endMin).toBe(1440);
  });

  it("reason / groupId を保持しつつ空文字は落とす", () => {
    const s = normalizeSettings({
      rules: [
        { type: "domain", domain: "a.com", reason: " 試験勉強 ", groupId: "sns" },
        { type: "domain", domain: "b.com", reason: "   " },
      ],
    });
    expect(s.rules[0].reason).toBe("試験勉強");
    expect(s.rules[0].groupId).toBe("sns");
    expect(s.rules[1].reason).toBeUndefined();
  });
});
