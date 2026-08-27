import { Card } from "@/components/ui/Card";
import {
  DAY_LABELS_JA,
  describeSchedule,
  formatMinutes,
  isScheduleActive,
} from "@/lib/schedule";
import { updateSettings } from "@/lib/storage";
import { STR } from "@/lib/strings";
import type { Settings } from "@/lib/types";

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (m === null) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const toHHMM = (min: number): string => {
  const h = Math.floor(min / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
};

export const ScheduleSection = ({ settings }: { settings: Settings }) => {
  const { schedule, strictMode } = settings;
  const scheduledRuleCount = settings.rules.filter((r) => r.timing === "schedule").length;
  const activeNow = isScheduleActive(schedule, new Date());

  const patch = (partial: Partial<Settings["schedule"]>) =>
    void updateSettings((s) => ({ ...s, schedule: { ...s.schedule, ...partial } }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">{STR.sectionSchedule}</h1>
        <p className="mt-1 text-sm text-muted">
          「スケジュール時のみ」に設定したルールが効く時間帯を決めます。
          仕事中だけブロックして、休みの日は自由に —— 続けられる運用を作りましょう。
        </p>
      </header>

      {strictMode && (
        <p className="rounded-lg bg-accent-500/[0.08] px-4 py-3 text-sm font-medium text-accent-600 dark:text-accent-400">
          {STR.strictLocked}
        </p>
      )}

      <Card
        title="ブロックする時間帯"
        action={
          <span
            className={`text-xs font-medium ${
              activeNow ? "text-accent-600 dark:text-accent-400" : "text-muted"
            }`}
          >
            いまは{activeNow ? "ブロック時間内" : "ブロック時間外"}
          </span>
        }
      >
        <div className="mb-4 flex flex-wrap gap-1.5">
          {DAY_LABELS_JA.map((label, i) => (
            <button
              key={label}
              type="button"
              disabled={strictMode}
              onClick={() =>
                patch({ days: schedule.days.map((d, j) => (j === i ? !d : d)) })
              }
              className={`size-9 cursor-pointer rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                schedule.days[i]
                  ? "bg-accent-500 font-semibold text-night-950"
                  : "border hairline text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.07]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            開始
            <input
              type="time"
              value={toHHMM(schedule.startMin)}
              disabled={strictMode}
              onChange={(e) => {
                const min = toMinutes(e.target.value);
                if (min !== null) patch({ startMin: min });
              }}
              className="rounded-lg border hairline bg-transparent px-3 py-2 tabular-nums outline-none focus:border-accent-500/70"
            />
          </label>
          <span className="text-muted">〜</span>
          <label className="flex items-center gap-2">
            終了
            <input
              type="time"
              value={toHHMM(schedule.endMin % 1440)}
              disabled={strictMode}
              onChange={(e) => {
                const min = toMinutes(e.target.value);
                if (min !== null) patch({ endMin: min });
              }}
              className="rounded-lg border hairline bg-transparent px-3 py-2 tabular-nums outline-none focus:border-accent-500/70"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-muted">
          現在の設定: {describeSchedule(schedule)}
          {schedule.startMin > schedule.endMin &&
            `（${formatMinutes(schedule.startMin)} から翌日 ${formatMinutes(schedule.endMin)} まで）`}
        </p>
      </Card>

      <Card title="このスケジュールを使っているルール">
        {scheduledRuleCount === 0 ? (
          <p className="text-xs text-muted">
            まだありません。ブロックルールの「編集」から「スケジュール時のみ」に
            切り替えると、この時間帯だけブロックされます。
            なお、フォーカスモード中（作業ポモドーロ中）は時間帯外でもブロックされます。
          </p>
        ) : (
          <p className="text-sm">
            {scheduledRuleCount} 件のルールがこのスケジュールに従います。
            <span className="text-xs text-muted">
              （フォーカスモード中は時間帯外でもブロックされます）
            </span>
          </p>
        )}
      </Card>
    </div>
  );
};
