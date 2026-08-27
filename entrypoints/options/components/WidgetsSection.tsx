import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { updateSettings } from "@/lib/storage";
import { STR } from "@/lib/strings";
import type { Settings, WidgetSettings } from "@/lib/types";

const patchWidgets = (fn: (w: WidgetSettings) => WidgetSettings) => {
  return updateSettings((s) => ({ ...s, widgets: fn(s.widgets) }));
};

/** 1 行ぶんのやる気メッセージ（ローカル編集 + blur で確定） */
const MessageRow = ({ message, index }: { message: string; index: number }) => {
  const [draft, setDraft] = useState(message);
  const dirty = draft.trim() !== message;

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === message) return;
    void patchWidgets((w) => ({
      ...w,
      motivation: {
        ...w.motivation,
        messages:
          trimmed === ""
            ? w.motivation.messages.filter((_, i) => i !== index)
            : w.motivation.messages.map((m, i) => (i === index ? trimmed : m)),
      },
    }));
  };

  return (
    <li className="flex items-center gap-2">
      <TextField
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        aria-label={`やる気メッセージ ${index + 1}`}
      />
      {/* 変更があるときだけ保存を出す（暗黙保存だけだと保存されたか分からない） */}
      {dirty && (
        <Button variant="primary" size="sm" className="shrink-0" onClick={commit}>
          保存
        </Button>
      )}
      <Button
        variant="quiet"
        size="sm"
        className="shrink-0 hover:text-red-600 dark:hover:text-red-400"
        onClick={() =>
          void patchWidgets((w) => ({
            ...w,
            motivation: {
              ...w.motivation,
              messages: w.motivation.messages.filter((_, i) => i !== index),
            },
          }))
        }
        aria-label={`メッセージ「${message}」を削除`}
      >
        <Icon name="trash" size={15} />
      </Button>
    </li>
  );
};

const MotivationEditor = ({ settings }: { settings: Settings }) => {
  const { motivation } = settings.widgets;
  const [newMessage, setNewMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const add = () => {
    const trimmed = newMessage.trim();
    if (trimmed === "") return;
    void patchWidgets((w) => ({
      ...w,
      motivation: { ...w.motivation, messages: [...w.motivation.messages, trimmed] },
    }));
    setNewMessage("");
  };

  return (
    <Card
      title="やる気が出るテキスト"
      action={
        <Switch
          checked={motivation.enabled}
          onChange={(enabled) =>
            void patchWidgets((w) => ({
              ...w,
              motivation: { ...w.motivation, enabled },
            }))
          }
          aria-label="やる気テキストを表示する"
        />
      }
    >
      <p className="mb-3 text-xs text-muted">
        ブロック画面にランダムで 1 つ表示されます。自分に刺さる言葉を登録しましょう。
      </p>

      <ul className="space-y-2">
        {motivation.messages.map((message, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: メッセージは ID を持たない文字列で並び替えもない。内容込みキーで編集確定時は意図的に再マウントさせる
          <MessageRow key={`${i}-${message}`} message={message} index={i} />
        ))}
      </ul>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <TextField
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="新しいメッセージを追加"
          aria-label="新しいやる気メッセージ"
        />
        <Button type="submit" className="shrink-0" disabled={newMessage.trim() === ""}>
          <Icon name="plus" size={15} />
          追加
        </Button>
      </form>

      {motivation.messages.length > 0 && (
        <div className="mt-4">
          <Button
            size="sm"
            onClick={() =>
              setPreview(
                motivation.messages[
                  Math.floor(Math.random() * motivation.messages.length)
                ],
              )
            }
          >
            ランダムプレビュー
          </Button>
          {preview !== null && (
            <blockquote className="sunken mt-3 rounded-lg p-4 text-center text-base font-medium">
              {preview}
            </blockquote>
          )}
        </div>
      )}
    </Card>
  );
};

const NumberField = ({
  value,
  onCommit,
  label,
  suffix,
  min = 1,
  max = 120,
}: {
  value: number;
  onCommit: (v: number) => void;
  label: string;
  suffix: string;
  min?: number;
  max?: number;
}) => {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-16">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= min && n <= max) onCommit(Math.round(n));
        }}
        className="w-20 rounded-lg border hairline bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-accent-500/70"
      />
      <span className="text-muted">{suffix}</span>
    </label>
  );
};

export const WidgetsSection = ({ settings }: { settings: Settings }) => {
  const { todo, pomodoro } = settings.widgets;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">{STR.sectionWidgets}</h1>
        <p className="mt-1 text-sm text-muted">
          ブロック画面に表示するウィジェットをカスタマイズできます。
        </p>
      </header>

      <MotivationEditor settings={settings} />

      <Card
        title="やることリスト"
        action={
          <Switch
            checked={todo.enabled}
            onChange={(enabled) =>
              void patchWidgets((w) => ({ ...w, todo: { enabled } }))
            }
            aria-label="やることリストを表示する"
          />
        }
      >
        <p className="text-xs text-muted">
          ブロック画面で「本来やるべきこと」をすぐ書き出せます。項目はブロック画面で追加・完了できます。
        </p>
      </Card>

      <Card
        title="ポモドーロタイマー"
        action={
          <Switch
            checked={pomodoro.enabled}
            onChange={(enabled) =>
              void patchWidgets((w) => ({
                ...w,
                pomodoro: { ...w.pomodoro, enabled },
              }))
            }
            aria-label="ポモドーロタイマーを表示する"
          />
        }
      >
        <div className="flex flex-col gap-3">
          <NumberField
            label="作業時間"
            suffix="分（ブロック画面でも切り替えられます）"
            value={pomodoro.workMin}
            onCommit={(workMin) =>
              void patchWidgets((w) => ({
                ...w,
                pomodoro: { ...w.pomodoro, workMin },
              }))
            }
          />
          <NumberField
            label="休憩時間"
            suffix="分"
            value={pomodoro.breakMin}
            onCommit={(breakMin) =>
              void patchWidgets((w) => ({
                ...w,
                pomodoro: { ...w.pomodoro, breakMin },
              }))
            }
          />
          <NumberField
            label="1日の目標"
            suffix="ポモドーロ（ストリーク判定に使用）"
            min={1}
            max={16}
            value={settings.dailyPomodoroGoal}
            onCommit={(dailyPomodoroGoal) =>
              void updateSettings((s) => ({ ...s, dailyPomodoroGoal }))
            }
          />
          <label className="flex cursor-pointer items-center justify-between text-sm">
            <span>作業・休憩の切り替わりを通知する</span>
            <Switch
              checked={pomodoro.notify}
              onChange={(notify) =>
                void patchWidgets((w) => ({
                  ...w,
                  pomodoro: { ...w.pomodoro, notify },
                }))
              }
              aria-label="ポモドーロ完了時に通知する"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between text-sm">
            <span>切り替わりのチャイム音（拡張ページを開いている時）</span>
            <Switch
              checked={pomodoro.sound}
              onChange={(sound) =>
                void patchWidgets((w) => ({
                  ...w,
                  pomodoro: { ...w.pomodoro, sound },
                }))
              }
              aria-label="チャイム音"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
            <span>
              フォーカスモード
              <span className="block text-xs text-muted">
                作業ポモドーロ中は一時許可を禁止し、スケジュール外のルールも強制ブロック
              </span>
            </span>
            <Switch
              checked={pomodoro.focusMode}
              onChange={(focusMode) =>
                void patchWidgets((w) => ({
                  ...w,
                  pomodoro: { ...w.pomodoro, focusMode },
                }))
              }
              aria-label="フォーカスモード"
            />
          </label>
        </div>
      </Card>
    </div>
  );
};
