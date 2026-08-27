// ユーザーに見える主要な文言の集約（すべて日本語）。
// コンポーネント固有の細かなラベルは各コンポーネントに置いてよいが、
// 複数箇所で使う文言・エラーメッセージはここに集める。

import { MAX_RULES } from "./types";

export const STR = {
  appName: "Motivase Site Blocker",

  // ブロック画面
  blockedTitle: "このサイトはブロック中です",
  blockedSubtitle: "今は集中の時間。あなたの目標に戻りましょう。",
  anotherMessage: "べつの一言",
  openSite: "サイトを開く",
  alreadyUnblocked: "このサイトはすでにブロック解除されています",
  dashboardTitle: "フォーカスダッシュボード",

  // 一時許可
  tempAllowLead: "どうしても必要なときだけ、時間を決めて開けます",
  tempAllowButton: (label: string) => `${label}だけ開く`,
  tempAllowActive: "一時許可中",
  reblockNow: "今すぐ再ブロック",

  // popup
  blockThisSite: "このサイトをブロック",
  notBlockable: "このページはブロックできません",
  notBlockableHint: "http / https のサイトを開いた状態で使ってください",
  siteIsBlocked: "このサイトはブロック対象です",
  goToBlockedPage: "ブロック画面へ移動",
  openOptions: "設定",
  scopeDomain: "このドメイン全体",
  scopeDomainHint: "サブドメインを含む",
  scopeHost: "このホストのみ",
  scopeHostHint: "サブドメインは含まない",
  scopePrefix: "このページのパス配下",
  scopePrefixHint: "同じパスで始まるページ",

  // options
  optionsTitle: "設定",
  sectionRules: "ブロックルール",
  sectionSchedule: "スケジュール",
  sectionWidgets: "ブロック画面",
  sectionTempAllow: "一時許可",
  sectionStats: "統計",
  sectionSafety: "厳格モード",
  sectionBackup: "バックアップ",
  strictLocked: "厳格モード中はこの設定を変更できません",

  // エラー
  errRuleLimit: `ルールの上限（${MAX_RULES}件）に達しました`,
  errRuleUnsupported: "このパターンは登録できません（複雑すぎます）",
  errDuplicateRule: "同じルールがすでに登録されています",

  // ポモドーロ
  pomodoroWork: "作業中",
  pomodoroBreak: "休憩中",
  pomodoroIdle: "ポモドーロ",
  pomodoroStart: "開始",
  pomodoroResume: "再開",
  pomodoroPause: "一時停止",
  pomodoroReset: "リセット",
  pomodoroSkip: "スキップ",
  notifyWorkDone: (breakMin: number) => `作業お疲れさま！☕ ${breakMin}分休憩しましょう`,
  notifyBreakDone: "休憩終了！次のポモドーロを始めましょう 🔥",
} as const;
