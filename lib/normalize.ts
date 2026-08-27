// 古い形のデータ（フィールドが欠けている・型が違う）を DEFAULT_SETTINGS で補完する正規化層。
// storage の読み書きとバックアップのインポートは必ずここを通すことで、
// スキーマにフィールドを足しても migration を書かずに済む（欠損はデフォルトで埋まる）。
//
// ここでいう「古い形」は公開済みの旧リリースに限らない。開発中に自分が使っていた
// ビルドが書いたデータ、他の環境から持ち込んだバックアップ JSON、手で編集された
// storage の中身も同じ経路で安全に扱う。
import { isThemePref } from "./theme";
import type {
  BlockRule,
  FrictionSettings,
  Schedule,
  Settings,
  WidgetSettings,
} from "./types";
import {
  ALLOW_DURATION_MAX_SEC,
  ALLOW_DURATION_MIN_SEC,
  DEFAULT_SETTINGS,
  MAX_ALLOW_DURATIONS,
  MAX_RULES,
} from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const PATTERN_TYPES = new Set(["domain", "host", "prefix"]);

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function optionalText(v: unknown, maxLen: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, maxLen);
  return t === "" ? undefined : t;
}

/** ルール 1 件の正規化。復元不能なら null */
export function normalizeRule(v: unknown): BlockRule | null {
  if (!isRecord(v)) return null;
  if (typeof v.domain !== "string" || v.domain === "") return null;
  if (typeof v.type !== "string" || !PATTERN_TYPES.has(v.type)) return null;
  const type = v.type as BlockRule["type"];
  const path = typeof v.path === "string" && v.path.startsWith("/") ? v.path : undefined;
  if (type === "prefix" && path === undefined) return null;
  const reason = optionalText(v.reason, 200);
  const groupId = optionalText(v.groupId, 50);
  return {
    id: typeof v.id === "string" && v.id !== "" ? v.id : crypto.randomUUID(),
    dnrId:
      typeof v.dnrId === "number" && Number.isInteger(v.dnrId) && v.dnrId >= 1
        ? v.dnrId
        : 0,
    type,
    domain: v.domain.toLowerCase(),
    ...(type === "prefix" ? { path } : {}),
    enabled: bool(v.enabled, true),
    createdAt: typeof v.createdAt === "number" ? v.createdAt : 0,
    timing: v.timing === "schedule" ? "schedule" : "always",
    ...(reason !== undefined ? { reason } : {}),
    ...(groupId !== undefined ? { groupId } : {}),
  };
}

function normalizeSchedule(v: unknown): Schedule {
  const def = DEFAULT_SETTINGS.schedule;
  if (!isRecord(v)) return { ...def, days: [...def.days] };
  const rawDays = v.days;
  const days = Array.isArray(rawDays)
    ? Array.from({ length: 7 }, (_, i) => rawDays[i] === true)
    : [...def.days];
  return {
    days,
    startMin: clampInt(v.startMin, 0, 1439, def.startMin),
    endMin: clampInt(v.endMin, 0, 1440, def.endMin),
  };
}

function normalizeFriction(v: unknown): FrictionSettings {
  const def = DEFAULT_SETTINGS.friction;
  if (!isRecord(v)) return { ...def };
  return {
    waitSec: clampInt(v.waitSec, 0, 120, def.waitSec),
    requireReason: bool(v.requireReason, def.requireReason),
  };
}

function normalizeWidgets(v: unknown): WidgetSettings {
  const def = DEFAULT_SETTINGS.widgets;
  if (!isRecord(v)) return structuredClone(def);
  const motivation = isRecord(v.motivation) ? v.motivation : {};
  const todo = isRecord(v.todo) ? v.todo : {};
  const pomodoro = isRecord(v.pomodoro) ? v.pomodoro : {};
  return {
    motivation: {
      enabled: bool(motivation.enabled, def.motivation.enabled),
      messages: Array.isArray(motivation.messages)
        ? motivation.messages
            .filter((m): m is string => typeof m === "string" && m.trim() !== "")
            .slice(0, 100)
        : [...def.motivation.messages],
    },
    todo: { enabled: bool(todo.enabled, def.todo.enabled) },
    pomodoro: {
      enabled: bool(pomodoro.enabled, def.pomodoro.enabled),
      workMin: clampInt(pomodoro.workMin, 1, 120, def.pomodoro.workMin),
      breakMin: clampInt(pomodoro.breakMin, 1, 120, def.pomodoro.breakMin),
      notify: bool(pomodoro.notify, def.pomodoro.notify),
      focusMode: bool(pomodoro.focusMode, def.pomodoro.focusMode),
      sound: bool(pomodoro.sound, def.pomodoro.sound),
    },
  };
}

export function normalizeAllowDurations(v: unknown): number[] {
  if (!Array.isArray(v)) return [...DEFAULT_SETTINGS.allowDurations];
  return [
    ...new Set(
      v
        .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
        .map((n) => Math.round(n))
        .filter((n) => n >= ALLOW_DURATION_MIN_SEC && n <= ALLOW_DURATION_MAX_SEC),
    ),
  ]
    .sort((a, b) => a - b)
    .slice(0, MAX_ALLOW_DURATIONS);
}

/**
 * 任意のオブジェクトを Settings に正規化する。
 * dnrId が欠損・重複しているルールには振り直しを行う。
 */
export function normalizeSettings(raw: unknown): Settings {
  const v = isRecord(raw) ? raw : {};

  const rules: BlockRule[] = [];
  if (Array.isArray(v.rules)) {
    for (const r of v.rules) {
      const rule = normalizeRule(r);
      if (rule !== null && rules.length < MAX_RULES) rules.push(rule);
    }
  }
  // dnrId の欠損（0）や重複を振り直す
  const usedIds = new Set<number>();
  let maxId = 0;
  for (const rule of rules) {
    if (rule.dnrId >= 1 && !usedIds.has(rule.dnrId)) {
      usedIds.add(rule.dnrId);
      maxId = Math.max(maxId, rule.dnrId);
    } else {
      rule.dnrId = 0;
    }
  }
  for (const rule of rules) {
    if (rule.dnrId === 0) {
      maxId += 1;
      rule.dnrId = maxId;
    }
  }

  return {
    rules,
    nextDnrId: Math.max(maxId + 1, clampInt(v.nextDnrId, 1, Number.MAX_SAFE_INTEGER, 1)),
    allowDurations: normalizeAllowDurations(v.allowDurations),
    schedule: normalizeSchedule(v.schedule),
    friction: normalizeFriction(v.friction),
    tempAllowBudgetMin:
      typeof v.tempAllowBudgetMin === "number" && Number.isFinite(v.tempAllowBudgetMin)
        ? clampInt(v.tempAllowBudgetMin, 1, 24 * 60, 30)
        : null,
    dailyPomodoroGoal: clampInt(v.dailyPomodoroGoal, 1, 16, 1),
    strictMode: bool(v.strictMode, false),
    weeklyReview: bool(v.weeklyReview, true),
    theme: isThemePref(v.theme) ? v.theme : DEFAULT_SETTINGS.theme,
    widgets: normalizeWidgets(v.widgets),
  };
}
