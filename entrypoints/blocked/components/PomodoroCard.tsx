import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { playChime } from "@/lib/chime";
import { formatClock } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";
import { useStorageItem } from "@/lib/hooks/useStorageItem";
import { sendToBackground } from "@/lib/messages";
import { remainingMs } from "@/lib/pomodoro";
import { pomodoroItem, todosItem, updateSettings } from "@/lib/storage";
import { STR } from "@/lib/strings";
import { POMODORO_WORK_PRESETS } from "@/lib/types";

interface Props {
  workMin: number;
  breakMin: number;
  sound: boolean;
  focusMode: boolean;
  dailyGoal: number;
  pomodorosToday: number;
}

const CONFETTI = ["🎉", "🍅", "✨", "🎊", "⭐"];

/**
 * ポモドーロタイマー。状態は storage.local の endsAt ベースなので
 * ページをリロードしても SW が再起動しても残り時間は狂わない。
 *
 * 作業時間は「その場で選べる」ことが重要（25 分固定だと、いま自分が使える
 * 時間と合わず、タイマーを使う意味が薄れる）。選んだ長さは設定に保存され、
 * 次回の既定値になる。
 */
export const PomodoroCard = ({
  workMin,
  breakMin,
  sound,
  focusMode,
  dailyGoal,
  pomodorosToday,
}: Props) => {
  const state = useStorageItem(pomodoroItem);
  const todos = useStorageItem(todosItem);
  const now = useNow(250);
  const prevPhase = useRef<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  // フェーズ遷移の検知（work → break = 1 ポモドーロ完了）
  useEffect(() => {
    if (state === undefined) return;
    const prev = prevPhase.current;
    prevPhase.current = state.phase;
    if (prev === null || prev === state.phase) return;
    if (prev === "work" && state.phase === "break") {
      if (sound) playChime("workDone");
      setCelebrating(true);
      const id = setTimeout(() => setCelebrating(false), 3200);
      return () => clearTimeout(id);
    }
    if (prev === "break" && state.phase === "work" && sound) {
      playChime("breakDone");
    }
  }, [state, sound]);

  if (state === undefined) return null;

  const rem = remainingMs(state, now);
  const totalMs = state.phase === "break" ? breakMin * 60_000 : workMin * 60_000;
  const displayMs = rem ?? workMin * 60_000;
  const progress = state.phase === "idle" ? 0 : Math.min(1, 1 - displayMs / totalMs);
  const idle = state.phase === "idle";

  // 未完了の先頭 =「いま最優先」。何のための作業時間かをタイマーの横に出す
  const topTodo = todos?.find((t) => !t.done)?.text;

  const phaseLabel =
    state.phase === "work"
      ? STR.pomodoroWork
      : state.phase === "break"
        ? STR.pomodoroBreak
        : STR.pomodoroIdle;

  // 設定で任意の分数にしている場合も選択肢に混ぜて見せる
  const presets = [...new Set([...POMODORO_WORK_PRESETS, workMin])].sort((a, b) => a - b);

  const send = (cmd: "start" | "pause" | "reset" | "skip") =>
    void sendToBackground({ type: "POMODORO", cmd });

  return (
    <Card
      className="relative overflow-hidden"
      title={
        <span className="flex items-center gap-2">
          <span
            className={`inline-block size-1.5 rounded-full ${
              state.phase === "work"
                ? "animate-pulse bg-accent-500"
                : state.phase === "break"
                  ? "bg-emerald-500"
                  : "bg-current opacity-30"
            }`}
          />
          {phaseLabel}
          {state.phase === "work" && focusMode && (
            <span className="flex items-center gap-1 text-[11px] font-normal text-accent-600 dark:text-accent-400">
              <Icon name="lock" size={12} />
              フォーカスモード
            </span>
          )}
        </span>
      }
      action={
        <span className="text-xs text-muted tabular-nums">
          今日 {pomodorosToday} / {dailyGoal}
        </span>
      }
    >
      {celebrating && (
        <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
          {CONFETTI.map((emoji, i) => (
            <span
              key={emoji}
              className="animate-confetti absolute text-2xl"
              style={{
                left: `${12 + i * 18}%`,
                animationDelay: `${i * 0.12}s`,
              }}
            >
              {emoji}
            </span>
          ))}
          <p className="absolute inset-x-0 top-1 text-center text-sm font-semibold text-accent-600 dark:text-accent-400">
            1 ポモドーロ完了。おつかれさま
          </p>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <div
          className="text-[3.25rem] leading-none font-semibold tracking-tight tabular-nums"
          aria-live="off"
        >
          {formatClock(displayMs)}
        </div>

        {idle ? (
          <fieldset
            className="flex min-w-0 flex-wrap justify-center gap-1"
            aria-label="作業時間を選ぶ"
          >
            {presets.map((min) => {
              const selected = min === workMin;
              return (
                <button
                  key={min}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    void updateSettings((s) => ({
                      ...s,
                      widgets: {
                        ...s.widgets,
                        pomodoro: { ...s.widgets.pomodoro, workMin: min },
                      },
                    }))
                  }
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs tabular-nums transition-colors ${
                    selected
                      ? "bg-black/[0.07] font-semibold dark:bg-white/[0.12]"
                      : "text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.07]"
                  }`}
                >
                  {min}分
                </button>
              );
            })}
          </fieldset>
        ) : (
          <div className="h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-accent-500 transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        <div className="flex gap-2">
          {idle ? (
            <Button variant="primary" onClick={() => send("start")}>
              <Icon name="play" size={15} />
              {STR.pomodoroStart}
            </Button>
          ) : state.running ? (
            <>
              <Button onClick={() => send("pause")}>
                <Icon name="pause" size={15} />
                {STR.pomodoroPause}
              </Button>
              <Button onClick={() => send("skip")}>
                <Icon name="skip" size={15} />
                {STR.pomodoroSkip}
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={() => send("start")}>
                <Icon name="play" size={15} />
                {STR.pomodoroResume}
              </Button>
              <Button onClick={() => send("reset")}>{STR.pomodoroReset}</Button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted">
          {idle
            ? `${workMin}分 作業して ${breakMin}分 休憩します`
            : state.phase === "work"
              ? `このあと ${breakMin}分 休憩`
              : `休憩のあと ${workMin}分 作業`}
        </p>

        {state.phase === "work" && topTodo !== undefined && (
          <p className="max-w-full truncate text-center text-sm">
            <span className="mr-1.5 text-xs text-muted">いま取り組むこと</span>
            {topTodo}
          </p>
        )}
      </div>
    </Card>
  );
};
