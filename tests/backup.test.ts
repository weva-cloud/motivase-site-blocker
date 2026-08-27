import { describe, expect, it } from "vitest";
import {
  backupFilename,
  createBackup,
  serializeBackup,
  validateBackup,
} from "../lib/backup";
import { DEFAULT_SETTINGS, EMPTY_STATS } from "../lib/types";

describe("createBackup / serializeBackup / backupFilename", () => {
  it("ラウンドトリップできる", () => {
    const backup = createBackup(
      DEFAULT_SETTINGS,
      [{ id: "1", text: "資料を書く", done: false, createdAt: 1 }],
      {
        days: {
          "2026-07-12": {
            blocks: 3,
            blocksByDomain: { "x.com": 3 },
            allowSec: 60,
            allowSecByDomain: { "x.com": 60 },
            pomodoros: 2,
          },
        },
      },
      new Date("2026-07-12T00:00:00Z"),
    );
    const parsed = validateBackup(JSON.parse(serializeBackup(backup)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.todos).toHaveLength(1);
    expect(parsed.data.settings.allowDurations).toEqual(DEFAULT_SETTINGS.allowDurations);
    expect(parsed.data.stats?.days["2026-07-12"]?.pomodoros).toBe(2);
  });

  it("ファイル名は日付入り", () => {
    expect(backupFilename(new Date(2026, 6, 12))).toBe(
      "motivase-site-blocker-20260712.json",
    );
  });
});

describe("validateBackup", () => {
  it.each([
    [null],
    ["text"],
    [{}],
    [{ app: "other-app", version: 1, settings: {} }],
    [{ app: "motivase-site-blocker", version: 99, settings: {} }],
    [{ app: "motivase-site-blocker", version: 1 }],
  ])("不正データ %j を日本語エラーで拒否する", (json) => {
    const result = validateBackup(json);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it("v1（旧名称 app id・統計なし・timing なし）のバックアップも受け付ける", () => {
    const result = validateBackup({
      // 旧名称時代の識別子でも読める（後方互換）
      app: "motivase-site-block",
      version: 1,
      settings: {
        rules: [{ type: "domain", domain: "youtube.com", enabled: true }],
        allowDurations: [10, 60],
      },
      todos: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.settings.rules[0].timing).toBe("always");
    expect(result.data.settings.friction.waitSec).toBe(DEFAULT_SETTINGS.friction.waitSec);
    expect(result.data.stats).toEqual(EMPTY_STATS);
  });

  it("壊れたルールをスキップし dnrId を一意に振り直す", () => {
    const result = validateBackup({
      app: "motivase-site-blocker",
      version: 2,
      settings: {
        rules: [
          { type: "domain", domain: "youtube.com", enabled: true, dnrId: 999 },
          { type: "bogus", domain: "x.com" },
          { type: "prefix", domain: "x.com" }, // prefix なのに path なし → 除外
          { type: "prefix", domain: "x.com", path: "/home", enabled: false },
          { domain: "" },
        ],
        allowDurations: [10, 10, -5, 99999, 60.4],
      },
      todos: [{ text: "やる" }, { text: "" }, "junk"],
      stats: { days: { "bad-key": {}, "2026-07-01": { blocks: "x", pomodoros: 3 } } },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { settings, todos, stats } = result.data;
    expect(settings.rules).toHaveLength(2);
    const ids = settings.rules.map((r) => r.dnrId);
    expect(new Set(ids).size).toBe(2);
    expect(settings.nextDnrId).toBeGreaterThan(Math.max(...ids));
    expect(settings.rules[1].enabled).toBe(false);
    // 範囲外・重複を除去し丸めてソート
    expect(settings.allowDurations).toEqual([10, 60]);
    expect(todos).toHaveLength(1);
    expect(todos[0].text).toBe("やる");
    // ウィジェット設定はデフォルトで補完される
    expect(settings.widgets.pomodoro.workMin).toBe(25);
    // 統計は不正キー除外・数値以外は 0 に
    expect(stats?.days["bad-key"]).toBeUndefined();
    expect(stats?.days["2026-07-01"]).toEqual({
      blocks: 0,
      blocksByDomain: {},
      allowSec: 0,
      allowSecByDomain: {},
      pomodoros: 3,
    });
  });
});
