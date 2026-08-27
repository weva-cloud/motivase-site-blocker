import { describe, expect, it } from "vitest";
import {
  describeSchedule,
  isScheduleActive,
  nextScheduleBoundary,
} from "../lib/schedule";
import type { Schedule } from "../lib/types";

// 平日 9:00〜18:00
const WEEKDAY: Schedule = {
  days: [false, true, true, true, true, true, false],
  startMin: 540,
  endMin: 1080,
};

// 毎日 22:00〜翌 2:00（日跨ぎ）
const NIGHT: Schedule = {
  days: [true, true, true, true, true, true, true],
  startMin: 22 * 60,
  endMin: 2 * 60,
};

// 2026-07-13 は月曜
const mon = (h: number, m = 0) => new Date(2026, 6, 13, h, m);
const sat = (h: number, m = 0) => new Date(2026, 6, 18, h, m);

describe("isScheduleActive", () => {
  it.each([
    [mon(9, 0), true],
    [mon(12, 0), true],
    [mon(17, 59), true],
    [mon(18, 0), false],
    [mon(8, 59), false],
    [sat(12, 0), false], // 土曜は対象外
  ])("平日 9-18: %s → %s", (d, expected) => {
    expect(isScheduleActive(WEEKDAY, d)).toBe(expected);
  });

  it("日跨ぎ: 22時以降と翌 2時前に有効", () => {
    expect(isScheduleActive(NIGHT, mon(23, 0))).toBe(true);
    expect(isScheduleActive(NIGHT, mon(1, 30))).toBe(true); // 前日日曜フラグ ON
    expect(isScheduleActive(NIGHT, mon(2, 0))).toBe(false);
    expect(isScheduleActive(NIGHT, mon(12, 0))).toBe(false);
  });

  it("幅ゼロ・曜日なしは無効", () => {
    expect(
      isScheduleActive(
        { days: [true, true, true, true, true, true, true], startMin: 540, endMin: 540 },
        mon(9),
      ),
    ).toBe(false);
  });
});

describe("nextScheduleBoundary", () => {
  it("時間帯内なら次は終了時刻", () => {
    const next = nextScheduleBoundary(WEEKDAY, mon(12, 0));
    expect(next).toBe(mon(18, 0).getTime());
  });

  it("時間帯前なら次は開始時刻", () => {
    const next = nextScheduleBoundary(WEEKDAY, mon(7, 0));
    expect(next).toBe(mon(9, 0).getTime());
  });

  it("週末は翌週月曜の開始", () => {
    const next = nextScheduleBoundary(WEEKDAY, sat(12, 0));
    expect(next).toBe(new Date(2026, 6, 20, 9, 0).getTime());
  });

  it("曜日が全部 OFF なら null", () => {
    expect(
      nextScheduleBoundary(
        {
          days: [false, false, false, false, false, false, false],
          startMin: 540,
          endMin: 1080,
        },
        mon(12),
      ),
    ).toBeNull();
  });
});

describe("describeSchedule", () => {
  it("日本語で説明する", () => {
    expect(describeSchedule(WEEKDAY)).toBe("月・火・水・木・金曜 9:00〜18:00");
    expect(describeSchedule(NIGHT)).toContain("毎日");
    expect(describeSchedule(NIGHT)).toContain("翌日");
  });
});
