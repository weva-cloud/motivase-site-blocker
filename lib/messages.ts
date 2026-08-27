// UI ⇔ background の型付きメッセージプロトコル。
// 原則は「UI は storage に書き、background が reconcile」だが、
// SW 側のタイマー・原子性・ガード（フォーカスロック / 日次予算）が
// 必要な操作だけメッセージで依頼する。

export type PomodoroCommand = "start" | "pause" | "reset" | "skip";

export type BgRequest =
  | { type: "TEMP_ALLOW"; domain: string; durationSec: number; reason?: string }
  | { type: "TEMP_ALLOW_REVOKE"; domain: string }
  | { type: "POMODORO"; cmd: PomodoroCommand }
  | { type: "BLOCK_HIT"; domain: string }
  | { type: "RESYNC" };

export type BgResponse = { ok: true } | { ok: false; error: string };

export function sendToBackground(msg: BgRequest): Promise<BgResponse> {
  return chrome.runtime.sendMessage<BgRequest, BgResponse>(msg);
}
