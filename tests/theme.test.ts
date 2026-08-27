import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../lib/normalize";
import { isThemePref, resolveTheme } from "../lib/theme";

describe("resolveTheme", () => {
  it("auto は OS 設定に従う", () => {
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
  });

  it("明示指定は OS 設定より優先される", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("isThemePref", () => {
  it("既知の値だけを受け入れる", () => {
    expect(isThemePref("auto")).toBe(true);
    expect(isThemePref("light")).toBe(true);
    expect(isThemePref("dark")).toBe(true);
    expect(isThemePref("sepia")).toBe(false);
    expect(isThemePref(null)).toBe(false);
  });
});

describe("normalizeSettings（テーマ）", () => {
  it("theme を持たない旧データは auto になる", () => {
    expect(normalizeSettings({ rules: [] }).theme).toBe("auto");
  });

  it("不正な theme は auto に落ちる", () => {
    expect(normalizeSettings({ theme: "solarized" }).theme).toBe("auto");
  });

  it("有効な theme は保持される", () => {
    expect(normalizeSettings({ theme: "light" }).theme).toBe("light");
  });
});
