import { Icon, type IconName } from "@/components/ui/Icon";
import { formatDurationJa } from "@/lib/format";
import { calcStreak, dateKey, getDayStats } from "@/lib/stats";
import type { Stats } from "@/lib/types";

interface Props {
  stats: Stats;
  dailyGoal: number;
  budgetMin: number | null;
}

const Stat = ({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) => {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <Icon name={icon} size={14} />
      {label}
      <span className="font-medium text-[color:var(--ui-text)] tabular-nums">
        {value}
      </span>
    </span>
  );
};

/** 今日の頑張りを一列で見せる（自己モニタリング） */
export const StatsStrip = ({ stats, dailyGoal, budgetMin }: Props) => {
  const today = getDayStats(stats, dateKey(new Date()));
  const streak = calcStreak(stats, dailyGoal, new Date());

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      <Stat icon="target" label="今日" value={`${today.pomodoros} / ${dailyGoal}`} />
      {streak >= 2 && <Stat icon="flame" label="連続" value={`${streak}日`} />}
      <Stat icon="ban" label="ブロック" value={`${today.blocks}回`} />
      <Stat
        icon="clock"
        label="一時許可"
        value={
          budgetMin !== null
            ? `${formatDurationJa(today.allowSec)} / ${budgetMin}分`
            : formatDurationJa(today.allowSec)
        }
      />
    </div>
  );
};
