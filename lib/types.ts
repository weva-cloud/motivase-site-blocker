/** ブロックパターンの種別 */
export type PatternType = "domain" | "host" | "prefix";
// domain: ホスト + 全サブドメイン、全パス（例: "youtube.com", "*.youtube.com"）
// host:   このホスト名に完全一致、全パス（サブドメインは含まない）
// prefix: ホスト + サブドメイン、パス前方一致（例: "x.com/home"）

/** ルールが効く時間帯: 常時 or グローバルスケジュールに従う */
export type RuleTiming = "always" | "schedule";

/** 配色テーマ。auto = OS の設定に追従 */
export type ThemePref = "auto" | "light" | "dark";

/** ブロックルール 1 件 */
export interface BlockRule {
  /** 内部 ID（crypto.randomUUID()） */
  id: string;
  /** DNR ルール ID（1 以上の整数。一度割り当てたら再利用しない） */
  dnrId: number;
  type: PatternType;
  /** 小文字・punycode 正規化済みホスト名（ポートなし。domain/prefix は www. 除去済み） */
  domain: string;
  /** prefix のみ: 先頭スラッシュ付き・末尾スラッシュなしの小文字パス（例: "/home"） */
  path?: string;
  enabled: boolean;
  createdAt: number;
  timing: RuleTiming;
  /** なぜブロックするか（実装意図）。ブロック画面に表示される */
  reason?: string;
  /** プリセット一括登録で付くグループ ID */
  groupId?: string;
}

/**
 * ブロックスケジュール（timing="schedule" のルールに適用されるグローバル定義）。
 * startMin > endMin のときは日を跨ぐ（例: 22:00〜02:00）。
 */
export interface Schedule {
  /** 曜日フラグ（0=日曜〜6=土曜） */
  days: boolean[];
  /** 開始（0:00 からの分） */
  startMin: number;
  /** 終了（0:00 からの分） */
  endMin: number;
}

/** 一時許可の摩擦（one sec 式の衝動ブレーキ） */
export interface FrictionSettings {
  /** 開くまでの待機秒数（0 = 待機なし） */
  waitSec: number;
  /** 開く理由の入力を必須にする */
  requireReason: boolean;
}

/** ブロック画面ウィジェットの設定 */
export interface WidgetSettings {
  motivation: { enabled: boolean; messages: string[] };
  todo: { enabled: boolean };
  pomodoro: {
    enabled: boolean;
    workMin: number;
    breakMin: number;
    notify: boolean;
    /** 作業フェーズ中: スケジュール外ルールも強制ブロック + 一時許可を禁止 */
    focusMode: boolean;
    /** フェーズ切替時にチャイムを鳴らす（拡張ページを開いている場合） */
    sound: boolean;
  };
}

/** 拡張全体の設定（chrome.storage.local） */
export interface Settings {
  rules: BlockRule[];
  /** 次に割り当てる DNR ルール ID */
  nextDnrId: number;
  /** 一時許可ボタンの秒数リスト（昇順・重複なし） */
  allowDurations: number[];
  /** timing="schedule" のルールに適用するスケジュール */
  schedule: Schedule;
  /** 一時許可の摩擦設定 */
  friction: FrictionSettings;
  /** 一時許可の 1 ドメインあたり日次予算（分）。null = 無制限 */
  tempAllowBudgetMin: number | null;
  /** ストリーク判定に使う 1 日のポモドーロ目標数 */
  dailyPomodoroGoal: number;
  /** 厳格モード: ルール削除・無効化や許可設定の緩和を禁止 */
  strictMode: boolean;
  /** 週次振り返り通知（月曜 9:00） */
  weeklyReview: boolean;
  /** 配色テーマ（auto = OS 追従） */
  theme: ThemePref;
  widgets: WidgetSettings;
}

/** 1 日ぶんの統計 */
export interface DayStats {
  /** ブロック画面が表示された回数 */
  blocks: number;
  blocksByDomain: Record<string, number>;
  /** 一時許可で消費した合計秒数 */
  allowSec: number;
  allowSecByDomain: Record<string, number>;
  /** 完了した作業ポモドーロ数 */
  pomodoros: number;
}

/** 統計（chrome.storage.local。キーはローカル日付 "YYYY-MM-DD"） */
export interface Stats {
  days: Record<string, DayStats>;
}

/** 一時許可の履歴 1 件（振り返り用） */
export interface AllowLogEntry {
  at: number;
  domain: string;
  durationSec: number;
  reason?: string;
}

/** やること 1 件（chrome.storage.local） */
export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

/** ポモドーロタイマーの状態（chrome.storage.local） */
export interface PomodoroState {
  phase: "idle" | "work" | "break";
  running: boolean;
  /** 実行中の終了予定時刻（epoch ms）。停止中は null */
  endsAt: number | null;
  /** 一時停止中の残り時間（ms）。それ以外は null */
  remainingMs: number | null;
  cyclesCompleted: number;
}

/** 一時許可 1 件（chrome.storage.session、ドメインをキーにした Record で保持） */
export interface TempAllow {
  /** DNR session ルールの ID */
  ruleId: number;
  /** 失効時刻（epoch ms） */
  expiresAt: number;
}

/** ルール数の自主上限（DNR の regex ルール上限 1000 に対する余裕） */
export const MAX_RULES = 300;

/** 一時許可の秒数として許容する範囲と個数 */
export const ALLOW_DURATION_MIN_SEC = 5;
export const ALLOW_DURATION_MAX_SEC = 3600;
export const MAX_ALLOW_DURATIONS = 6;

export const DEFAULT_MOTIVATION_MESSAGES = [
  "今は集中の時間。未来の自分が感謝してくれます。",
  "小さな一歩の積み重ねが、大きな成果になる。",
  "気が散ったら深呼吸。今日の目標を思い出そう。",
];

/** 平日 9:00〜18:00 */
export const DEFAULT_SCHEDULE: Schedule = {
  days: [false, true, true, true, true, true, false],
  startMin: 9 * 60,
  endMin: 18 * 60,
};

export const MAX_ALLOW_LOG_ENTRIES = 200;

/**
 * ブロック画面でその場で選べる作業時間（分）。
 * 選ぶと settings.widgets.pomodoro.workMin に保存され、次回の既定値になる。
 */
export const POMODORO_WORK_PRESETS = [15, 25, 45, 60];

export const DEFAULT_SETTINGS: Settings = {
  rules: [],
  nextDnrId: 1,
  allowDurations: [10, 60, 300, 600],
  schedule: DEFAULT_SCHEDULE,
  friction: { waitSec: 10, requireReason: true },
  tempAllowBudgetMin: null,
  dailyPomodoroGoal: 1,
  strictMode: false,
  weeklyReview: true,
  theme: "auto",
  widgets: {
    motivation: { enabled: true, messages: DEFAULT_MOTIVATION_MESSAGES },
    todo: { enabled: true },
    pomodoro: {
      enabled: true,
      workMin: 25,
      breakMin: 5,
      notify: true,
      focusMode: true,
      sound: true,
    },
  },
};

export const EMPTY_STATS: Stats = { days: {} };

export const EMPTY_DAY_STATS: DayStats = {
  blocks: 0,
  blocksByDomain: {},
  allowSec: 0,
  allowSecByDomain: {},
  pomodoros: 0,
};

export const IDLE_POMODORO: PomodoroState = {
  phase: "idle",
  running: false,
  endsAt: null,
  remainingMs: null,
  cyclesCompleted: 0,
};
