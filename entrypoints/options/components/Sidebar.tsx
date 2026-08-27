import { Icon, type IconName } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { STR } from "@/lib/strings";
import type { ThemePref } from "@/lib/types";

export type Section =
  | "rules"
  | "schedule"
  | "widgets"
  | "tempallow"
  | "stats"
  | "safety"
  | "backup";

const NAV: { key: Section; icon: IconName; label: string }[] = [
  { key: "rules", icon: "ban", label: STR.sectionRules },
  { key: "schedule", icon: "calendar", label: STR.sectionSchedule },
  { key: "widgets", icon: "sparkles", label: STR.sectionWidgets },
  { key: "tempallow", icon: "timer", label: STR.sectionTempAllow },
  { key: "stats", icon: "chart", label: STR.sectionStats },
  { key: "safety", icon: "shield", label: STR.sectionSafety },
  { key: "backup", icon: "archive", label: STR.sectionBackup },
];

interface Props {
  section: Section;
  onSelect: (section: Section) => void;
  ruleCount: number;
  strictMode: boolean;
  theme: ThemePref;
}

export const Sidebar = ({ section, onSelect, ruleCount, strictMode, theme }: Props) => {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r hairline px-3 py-6">
      <div className="mb-7 flex items-center gap-2.5 px-3">
        <img src="/icon/48.png" alt="" className="size-7 rounded-lg" />
        <div className="min-w-0">
          <div className="text-sm leading-tight font-semibold">{STR.appName}</div>
          <div className="text-[11px] text-muted">
            v{chrome.runtime.getManifest().version}
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV.map((item) => {
          const active = section === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(item.key)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                active
                  ? "bg-black/[0.05] font-semibold dark:bg-white/[0.08]"
                  : "text-muted hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
              }`}
            >
              <Icon name={item.icon} size={17} />
              <span className="flex-1">{item.label}</span>
              {item.key === "rules" && ruleCount > 0 && (
                <span className="text-[11px] text-muted tabular-nums">{ruleCount}</span>
              )}
              {item.key === "safety" && strictMode && (
                <Icon
                  name="lock"
                  size={14}
                  className="text-accent-600 dark:text-accent-400"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 px-1">
        <ThemeToggle value={theme} className="w-full" />
      </div>
    </aside>
  );
};
