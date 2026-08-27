// 設定のエクスポート / インポート（純粋関数のみ。ファイル I/O は呼び出し側）
import { normalizeSettings } from "./normalize";
import type { DayStats, Settings, Stats, TodoItem } from "./types";

export interface BackupFile {
  app: "motivase-site-blocker";
  version: 2;
  exportedAt: string;
  settings: Settings;
  todos: TodoItem[];
  /** v2 から統計も含める（任意） */
  stats?: Stats;
}

export type BackupValidation =
  | { ok: true; data: BackupFile }
  | { ok: false; error: string };

export function createBackup(
  settings: Settings,
  todos: TodoItem[],
  stats: Stats,
  exportedAt: Date,
): BackupFile {
  return {
    app: "motivase-site-blocker",
    version: 2,
    exportedAt: exportedAt.toISOString(),
    settings,
    todos,
    stats,
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** エクスポートファイル名（例: motivase-site-blocker-20260712.json） */
export function backupFilename(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `motivase-site-blocker-${y}${m}${d}.json`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
}

function numRecord(v: unknown): Record<string, number> {
  if (!isRecord(v)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(v)) {
    const n = num(value);
    if (n > 0) out[key] = n;
  }
  return out;
}

function sanitizeStats(v: unknown): Stats {
  if (!isRecord(v) || !isRecord(v.days)) return { days: {} };
  const days: Record<string, DayStats> = {};
  for (const [key, value] of Object.entries(v.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !isRecord(value)) continue;
    days[key] = {
      blocks: num(value.blocks),
      blocksByDomain: numRecord(value.blocksByDomain),
      allowSec: num(value.allowSec),
      allowSecByDomain: numRecord(value.allowSecByDomain),
      pomodoros: num(value.pomodoros),
    };
  }
  return { days };
}

/**
 * インポートされた JSON を検証し、正規化済みのバックアップデータを返す。
 * v1（統計なし）と v2 の両方を受け付ける。
 */
export function validateBackup(json: unknown): BackupValidation {
  if (!isRecord(json)) {
    return { ok: false, error: "バックアップファイルの形式が正しくありません" };
  }
  // 旧名称 "motivase-site-block" 時代のエクスポートも受け付ける
  if (json.app !== "motivase-site-blocker" && json.app !== "motivase-site-block") {
    return {
      ok: false,
      error: "このファイルは Motivase Site Blocker のバックアップではありません",
    };
  }
  if (json.version !== 1 && json.version !== 2) {
    return {
      ok: false,
      error: "このバックアップのバージョンには対応していません",
    };
  }
  if (!isRecord(json.settings)) {
    return { ok: false, error: "設定データが見つかりません" };
  }

  const todos: TodoItem[] = Array.isArray(json.todos)
    ? json.todos.flatMap((t): TodoItem[] => {
        if (!isRecord(t) || typeof t.text !== "string" || t.text.trim() === "") {
          return [];
        }
        return [
          {
            id: typeof t.id === "string" && t.id !== "" ? t.id : crypto.randomUUID(),
            text: t.text,
            done: typeof t.done === "boolean" ? t.done : false,
            createdAt: typeof t.createdAt === "number" ? t.createdAt : 0,
          },
        ];
      })
    : [];

  return {
    ok: true,
    data: {
      app: "motivase-site-blocker",
      version: 2,
      exportedAt: typeof json.exportedAt === "string" ? json.exportedAt : "",
      settings: normalizeSettings(json.settings),
      todos,
      stats: sanitizeStats(json.stats),
    },
  };
}
