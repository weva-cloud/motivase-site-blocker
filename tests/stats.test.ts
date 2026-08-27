import { describe, expect, it } from "vitest";
import {
  addAllowSec,
  addBlockHit,
  addPomodoro,
  calcStreak,
  dateKey,
  getDayStats,
  lastNDateKeys,
  pruneStats,
  summarizeRange,
  topBlockedDomains,
} from "../lib/stats";
import { EMPTY_STATS } from "../lib/types";

const TODAY = new Date(2026, 6, 12); // 日曜
const KEY = dateKey(TODAY);

describe("集計", () => {
  it("ブロック・許可・ポモドーロを日付キーで加算する", () => {
    let stats = addBlockHit(EMPTY_STATS, KEY, "x.com");
    stats = addBlockHit(stats, KEY, "x.com");
    stats = addAllowSec(stats, KEY, "x.com", 60);
    stats = addPomodoro(stats, KEY);
    const day = getDayStats(stats, KEY);
    expect(day.blocks).toBe(2);
    expect(day.blocksByDomain["x.com"]).toBe(2);
    expect(day.allowSec).toBe(60);
    expect(day.pomodoros).toBe(1);
  });

  it("許可の払い戻し（負値）は 0 を下回らない", () => {
    let stats = addAllowSec(EMPTY_STATS, KEY, "x.com", 30);
    stats = addAllowSec(stats, KEY, "x.com", -100);
    expect(getDayStats(stats, KEY).allowSec).toBe(0);
  });

  it("summarizeRange / topBlockedDomains", () => {
    const keys = lastNDateKeys(3, TODAY);
    let stats = addBlockHit(EMPTY_STATS, keys[0], "a.com");
    stats = addBlockHit(stats, keys[1], "b.com");
    stats = addBlockHit(stats, keys[1], "b.com");
    stats = addPomodoro(stats, keys[2]);
    expect(summarizeRange(stats, keys)).toEqual({
      blocks: 3,
      allowSec: 0,
      pomodoros: 1,
    });
    expect(topBlockedDomains(stats, 3, TODAY)).toEqual([
      ["b.com", 2],
      ["a.com", 1],
    ]);
  });

  it("pruneStats は保持日数外を消す", () => {
    const oldKey = "2020-01-01";
    let stats = addBlockHit(EMPTY_STATS, oldKey, "a.com");
    stats = addBlockHit(stats, KEY, "b.com");
    const pruned = pruneStats(stats, 30, TODAY);
    expect(pruned.days[oldKey]).toBeUndefined();
    expect(pruned.days[KEY]).toBeDefined();
  });
});

describe("calcStreak", () => {
  const day = (offset: number) =>
    dateKey(new Date(TODAY.getTime() - offset * 24 * 60 * 60 * 1000));

  it("今日達成済みなら今日を含めて数える", () => {
    let stats = addPomodoro(EMPTY_STATS, day(0));
    stats = addPomodoro(stats, day(1));
    stats = addPomodoro(stats, day(2));
    expect(calcStreak(stats, 1, TODAY)).toBe(3);
  });

  it("今日未達でも昨日までの連続は維持される", () => {
    let stats = addPomodoro(EMPTY_STATS, day(1));
    stats = addPomodoro(stats, day(2));
    expect(calcStreak(stats, 1, TODAY)).toBe(2);
  });

  it("途切れたらそこまで", () => {
    let stats = addPomodoro(EMPTY_STATS, day(0));
    stats = addPomodoro(stats, day(2)); // 昨日が抜けている
    expect(calcStreak(stats, 1, TODAY)).toBe(1);
  });

  it("目標数を満たさない日はカウントされない", () => {
    let stats = addPomodoro(EMPTY_STATS, day(0));
    stats = addPomodoro(stats, day(0)); // 今日 2 回
    stats = addPomodoro(stats, day(1)); // 昨日 1 回
    expect(calcStreak(stats, 2, TODAY)).toBe(1);
  });

  it("記録なしは 0", () => {
    expect(calcStreak(EMPTY_STATS, 1, TODAY)).toBe(0);
  });
});
