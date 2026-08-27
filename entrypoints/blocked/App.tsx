import { useEffect, useMemo, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ToastProvider } from "@/components/ui/Toast";
import { activeRules, isFocusLock } from "@/lib/active";
import { useSettings } from "@/lib/hooks/useSettings";
import { useStorageItem } from "@/lib/hooks/useStorageItem";
import { useTheme } from "@/lib/hooks/useTheme";
import { sendToBackground } from "@/lib/messages";
import { broadestAllowDomain, hostnameOf, matchesUrl } from "@/lib/pattern";
import { dateKey, getDayStats } from "@/lib/stats";
import { pomodoroItem, statsItem } from "@/lib/storage";
import { BlockHero } from "./components/BlockHero";
import { PomodoroCard } from "./components/PomodoroCard";
import { StatsStrip } from "./components/StatsStrip";
import { TempAllowBar } from "./components/TempAllowBar";
import { TodoCard } from "./components/TodoCard";

const App = () => {
  // DNR redirect が `blocked.html#u=<元URL>` の形で遷移させてくる。
  // リクエスト URL に # は含まれないため、hash 全体が元 URL そのもの
  const originalUrl = useMemo(() => {
    const h = window.location.hash;
    return h.startsWith("#u=") ? h.slice(3) : null;
  }, []);

  const settings = useSettings();
  const pomodoro = useStorageItem(pomodoroItem);
  const stats = useStorageItem(statsItem);
  const blockHitSent = useRef(false);
  useTheme(settings?.theme);

  const matched = useMemo(() => {
    if (settings === undefined || pomodoro === undefined || originalUrl === null) {
      return [];
    }
    return activeRules(settings, pomodoro, Date.now()).filter((r) =>
      matchesUrl(r, originalUrl),
    );
  }, [settings, pomodoro, originalUrl]);

  const allowDomain = broadestAllowDomain(matched);

  // 統計: ブロック画面の表示を 1 回だけ計上する
  useEffect(() => {
    if (blockHitSent.current || matched.length === 0 || allowDomain === null) return;
    blockHitSent.current = true;
    void sendToBackground({ type: "BLOCK_HIT", domain: allowDomain });
  }, [matched, allowDomain]);

  if (settings === undefined || pomodoro === undefined) return null;

  const host = originalUrl !== null ? hostnameOf(originalUrl) : null;
  const { widgets } = settings;
  const focusLock = isFocusLock(settings, pomodoro);
  const reason = matched.find((r) => r.reason !== undefined)?.reason;

  // 日次予算の残り（予算が有効なときのみ）
  const budgetRemainingSec =
    settings.tempAllowBudgetMin !== null && allowDomain !== null && stats !== undefined
      ? Math.max(
          0,
          settings.tempAllowBudgetMin * 60 -
            (getDayStats(stats, dateKey(new Date())).allowSecByDomain[allowDomain] ?? 0),
        )
      : null;

  return (
    <ToastProvider>
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-7 px-6 py-16">
        <BlockHero
          originalUrl={originalUrl}
          host={host}
          isStillBlocked={matched.length > 0}
          reason={reason}
          messages={widgets.motivation.enabled ? widgets.motivation.messages : []}
        />

        {stats !== undefined && (
          <StatsStrip
            stats={stats}
            dailyGoal={settings.dailyPomodoroGoal}
            budgetMin={settings.tempAllowBudgetMin}
          />
        )}

        {originalUrl !== null && allowDomain !== null && (
          <TempAllowBar
            originalUrl={originalUrl}
            domain={allowDomain}
            durations={settings.allowDurations}
            friction={settings.friction}
            focusLock={focusLock}
            budgetRemainingSec={budgetRemainingSec}
          />
        )}

        {(widgets.todo.enabled || widgets.pomodoro.enabled) && (
          <div className="grid w-full items-start gap-4 md:grid-cols-2">
            {widgets.todo.enabled && <TodoCard />}
            {widgets.pomodoro.enabled && (
              <PomodoroCard
                workMin={widgets.pomodoro.workMin}
                breakMin={widgets.pomodoro.breakMin}
                sound={widgets.pomodoro.sound}
                focusMode={widgets.pomodoro.focusMode}
                dailyGoal={settings.dailyPomodoroGoal}
                pomodorosToday={
                  stats !== undefined
                    ? getDayStats(stats, dateKey(new Date())).pomodoros
                    : 0
                }
              />
            )}
          </div>
        )}

        <footer className="mt-2 flex w-full items-center justify-between gap-4 border-t hairline pt-5">
          <button
            type="button"
            onClick={() => chrome.runtime.openOptionsPage()}
            className="flex cursor-pointer items-center gap-1.5 text-xs text-muted transition-colors hover:text-[color:var(--ui-text)]"
          >
            <Icon name="sliders" size={14} />
            ブロック設定・ウィジェットをカスタマイズ
          </button>
          <ThemeToggle value={settings.theme} />
        </footer>
      </main>
    </ToastProvider>
  );
};

export default App;
