import { updateSettings } from "@/lib/storage";
import type { ThemePref } from "@/lib/types";
import { Icon, type IconName } from "./Icon";

const OPTIONS: { value: ThemePref; label: string; icon: IconName }[] = [
  { value: "auto", label: "自動", icon: "monitor" },
  { value: "light", label: "ライト", icon: "sun" },
  { value: "dark", label: "ダーク", icon: "moon" },
];

/**
 * 配色テーマの 3 択（自動 = OS 追従）。設定は storage に書くだけ。
 * 幅は置き場所によって変わる（サイドバーは全幅、フッターは内容幅）ので
 * className で受け取る。既定で w-full にすると、隣の要素を潰してしまう。
 */
export const ThemeToggle = ({
  value,
  className = "",
}: {
  value: ThemePref;
  className?: string;
}) => {
  return (
    <fieldset
      className={`flex min-w-0 shrink-0 rounded-lg border hairline p-0.5 ${className}`}
      aria-label="配色テーマ"
    >
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={() => void updateSettings((s) => ({ ...s, theme: option.value }))}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              active
                ? "bg-black/5 text-[color:var(--ui-text)] dark:bg-white/10"
                : "text-muted hover:text-[color:var(--ui-text)]"
            }`}
          >
            <Icon name={option.icon} size={14} />
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
};
