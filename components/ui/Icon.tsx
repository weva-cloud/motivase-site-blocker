import type { ReactNode } from "react";

/**
 * 単色・線画のアイコン集（currentColor 追従）。
 * 絵文字はフォント依存で大きさも字面も揃わないため、UI の意味を担う箇所では使わない。
 * 祝福の演出（紙吹雪）など「絵」として意味がある箇所だけ絵文字を残している。
 */
export type IconName =
  | "ban"
  | "calendar"
  | "sparkles"
  | "timer"
  | "chart"
  | "shield"
  | "archive"
  | "plus"
  | "trash"
  | "pencil"
  | "search"
  | "sun"
  | "moon"
  | "monitor"
  | "undo"
  | "play"
  | "pause"
  | "skip"
  | "x"
  | "check"
  | "sliders"
  | "flame"
  | "clock"
  | "target"
  | "list"
  | "lock"
  | "grip"
  | "arrowUp"
  | "arrowDown"
  | "external";

const PATHS: Record<IconName, ReactNode> = {
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M8 3v5M16 3v5M3.5 10.5h17" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 3.5 12.8 8.7 18 10.5l-5.2 1.8L11 17.5l-1.8-5.2L4 10.5l5.2-1.8z" />
      <path d="m18 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.5 2M9.5 2.5h5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7.5 20v-5M12 20V9M16.5 20v-8" />
    </>
  ),
  shield: <path d="M12 3.2 19 6v6.2c0 4.1-2.8 7.3-7 8.6-4.2-1.3-7-4.5-7-8.6V6z" />,
  archive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5" />
      <path d="M5.5 9v9.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9M10 13h4" />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V5.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="m6.5 7 .9 12.1a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20.5h4.2L20 8.7a2.6 2.6 0 0 0-3.7-3.7L4.5 16.8z" />
      <path d="m15 6.5 2.5 2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m15.8 15.8 4.4 4.4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.5 12h2M19.5 12h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
    </>
  ),
  moon: <path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.5 8.5 0 1 0 20 14.4" />,
  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </>
  ),
  undo: <path d="M4 9.5h11a5 5 0 1 1 0 10h-5.5M4 9.5 8 5.5M4 9.5l4 4" />,
  play: <path d="M8.5 5.6 18 12l-9.5 6.4z" />,
  pause: <path d="M9.5 5.5v13M14.5 5.5v13" />,
  skip: (
    <>
      <path d="M6.5 5.6 15 12l-8.5 6.4z" />
      <path d="M18 5.5v13" />
    </>
  ),
  x: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  check: <path d="m5 12.5 4.6 4.6L19 6.5" />,
  sliders: (
    <>
      <path d="M4 7.5h8M16.5 7.5h3.5M4 16.5h3.5M12 16.5h8" />
      <circle cx="14.2" cy="7.5" r="2.2" />
      <circle cx="9.7" cy="16.5" r="2.2" />
    </>
  ),
  flame: (
    <>
      <path d="M12 3c3.2 3.6 5.2 6.3 5.2 9.3a5.2 5.2 0 0 1-10.4 0c0-1.6.5-3 1.6-4.3.3 1 .9 1.7 1.6 2.1C10.2 7.4 10.7 5.3 12 3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.4" />
    </>
  ),
  list: (
    <>
      <path d="M9.5 6.5h11M9.5 12h11M9.5 17.5h7.5" />
      <path d="m3.5 6.3 1.2 1.2 2.2-2.4M3.5 11.8 4.7 13l2.2-2.4M3.5 17.3l1.2 1.2 2.2-2.4" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </>
  ),
  grip: (
    <g fill="currentColor" stroke="none">
      <circle cx="9.5" cy="6" r="1.3" />
      <circle cx="14.5" cy="6" r="1.3" />
      <circle cx="9.5" cy="12" r="1.3" />
      <circle cx="14.5" cy="12" r="1.3" />
      <circle cx="9.5" cy="18" r="1.3" />
      <circle cx="14.5" cy="18" r="1.3" />
    </g>
  ),
  arrowUp: <path d="M12 19.5v-15M5.5 11 12 4.5l6.5 6.5" />,
  arrowDown: <path d="M12 4.5v15M5.5 13 12 19.5l6.5-6.5" />,
  external: (
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10" />
  ),
};

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  /** 線の太さ。小さいサイズでは細く見えるので調整できる */
  strokeWidth?: number;
}

export const Icon = ({ name, size = 18, className = "", strokeWidth = 1.6 }: Props) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
};
