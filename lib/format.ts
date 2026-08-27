// 時間表示のフォーマット（純粋関数）

/** 秒数 → 日本語ラベル（例: 10 → "10秒", 60 → "1分", 90 → "1分30秒"） */
export function formatDurationJa(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  if (min === 0) return `${sec}秒`;
  if (sec === 0) return `${min}分`;
  return `${min}分${sec}秒`;
}

/** 残りミリ秒 → "mm:ss" 表記（ポモドーロ用） */
export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 残りミリ秒 → カウントダウン用の日本語（例: "あと1分30秒"） */
export function formatRemainingJa(ms: number): string {
  return `あと${formatDurationJa(Math.ceil(ms / 1000))}`;
}
