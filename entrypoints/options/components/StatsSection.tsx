import { Card } from "@/components/ui/Card";
import { Favicon } from "@/components/ui/Favicon";
import { Icon, type IconName } from "@/components/ui/Icon";
import { formatDurationJa } from "@/lib/format";
import { useStorageItem } from "@/lib/hooks/useStorageItem";
import {
  calcStreak,
  dateKey,
  getDayStats,
  lastNDateKeys,
  summarizeRange,
  topBlockedDomains,
} from "@/lib/stats";
import { allowLogItem, statsItem } from "@/lib/storage";
import { STR } from "@/lib/strings";
import type { Settings, Stats } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const HEATMAP_WEEKS = 15;

const SummaryCard = ({
  icon,
  label,
  value,
  sub,
}: {
  icon: IconName;
  label: string;
  value: string;
  sub?: string;
}) => {
  return (
    <div className="card flex-1 basis-36 p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Icon name={icon} size={14} />
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
      {sub !== undefined && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
};

/** GitHub 風のポモドーロヒートマップ（直近 15 週） */
const Heatmap = ({ stats }: { stats: Stats }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 最終列が今週になるよう、開始をその週の日曜に合わせる
  const start = new Date(
    today.getTime() - (today.getDay() + (HEATMAP_WEEKS - 1) * 7) * DAY_MS,
  );

  const level = (n: number) =>
    n === 0
      ? "bg-black/[0.06] dark:bg-white/[0.08]"
      : n <= 1
        ? "bg-accent-500/30"
        : n <= 3
          ? "bg-accent-500/60"
          : "bg-accent-500";

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {Array.from({ length: HEATMAP_WEEKS }, (_, col) => {
        const weekStart = new Date(start.getTime() + col * 7 * DAY_MS);
        return (
          <div key={dateKey(weekStart)} className="flex flex-col gap-1">
            {Array.from({ length: 7 }, (_, row) => {
              const date = new Date(weekStart.getTime() + row * DAY_MS);
              const key = dateKey(date);
              if (date.getTime() > today.getTime()) {
                return <div key={key} className="size-3.5" />;
              }
              const n = getDayStats(stats, key).pomodoros;
              return (
                <div
                  key={key}
                  title={`${key}: ポモドーロ ${n} 回`}
                  className={`size-3.5 rounded-[3px] ${level(n)}`}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const StatsSection = ({ settings }: { settings: Settings }) => {
  const stats = useStorageItem(statsItem);
  const allowLog = useStorageItem(allowLogItem);

  if (stats === undefined) return null;

  const now = new Date();
  const today = getDayStats(stats, dateKey(now));
  const streak = calcStreak(stats, settings.dailyPomodoroGoal, now);
  const week = summarizeRange(stats, lastNDateKeys(7, now));
  const top = topBlockedDomains(stats, 7, now);
  const maxTop = top[0]?.[1] ?? 1;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">{STR.sectionStats}</h1>
        <p className="mt-1 text-sm text-muted">
          自分の集中を数字で振り返りましょう。記録はこの端末にだけ保存されます。
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <SummaryCard
          icon="target"
          label="今日のポモドーロ"
          value={`${today.pomodoros} / ${settings.dailyPomodoroGoal}`}
          sub={today.pomodoros >= settings.dailyPomodoroGoal ? "目標達成！" : "あと少し"}
        />
        <SummaryCard
          icon="flame"
          label="連続達成"
          value={`${streak}日`}
          sub={streak >= 2 ? "この調子！" : "今日から積み上げよう"}
        />
        <SummaryCard icon="ban" label="今日のブロック" value={`${today.blocks}回`} />
        <SummaryCard
          icon="clock"
          label="今日の一時許可"
          value={formatDurationJa(today.allowSec)}
          sub={
            settings.tempAllowBudgetMin !== null
              ? `予算 ${settings.tempAllowBudgetMin}分/日`
              : undefined
          }
        />
      </div>

      <Card title="ポモドーロヒートマップ（直近15週）">
        <Heatmap stats={stats} />
      </Card>

      <Card title="直近7日間">
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
          <span className="flex items-center gap-1.5">
            <Icon name="target" size={14} className="text-muted" />
            ポモドーロ <span className="tabular-nums">{week.pomodoros} 回</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="ban" size={14} className="text-muted" />
            ブロック <span className="tabular-nums">{week.blocks} 回</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="clock" size={14} className="text-muted" />
            一時許可{" "}
            <span className="tabular-nums">{formatDurationJa(week.allowSec)}</span>
          </span>
        </p>
      </Card>

      <Card title="よくブロックされたサイト（7日間）">
        {top.length === 0 ? (
          <p className="text-xs text-muted">まだ記録がありません。</p>
        ) : (
          <ul className="space-y-2">
            {top.map(([domain, count]) => (
              <li key={domain} className="flex items-center gap-2.5">
                <Favicon domain={domain} size={20} />
                <span className="w-48 truncate font-mono text-sm">{domain}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-accent-500"
                    style={{ width: `${(count / maxTop) * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right text-sm tabular-nums">{count}回</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="一時許可の履歴（振り返り）">
        {allowLog === undefined || allowLog.length === 0 ? (
          <p className="text-xs text-muted">まだ記録がありません。</p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {allowLog.slice(0, 30).map((entry) => (
              <li key={`${entry.at}-${entry.domain}`} className="text-xs">
                <span className="text-muted tabular-nums">
                  {new Date(entry.at).toLocaleString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>{" "}
                <span className="font-mono">{entry.domain}</span> を{" "}
                {formatDurationJa(entry.durationSec)}
                {entry.reason !== undefined && (
                  <span className="text-muted">「{entry.reason}」</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
