import type { ReactNode } from "react";
import type { PatternType } from "@/lib/types";

type Tone = "accent" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  accent: "bg-accent-500/12 text-accent-600 dark:text-accent-400",
  neutral: "border hairline text-muted",
};

export const Badge = ({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) => {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
};

/**
 * パターン種別バッジ。3 種を色で塗り分けると画面が賑やかになるだけなので、
 * 文字で区別し、色は使わない。
 */
export const PatternTypeBadge = ({ type }: { type: PatternType }) => {
  switch (type) {
    case "domain":
      return <Badge>ドメイン全体</Badge>;
    case "host":
      return <Badge>ホスト一致</Badge>;
    case "prefix":
      return <Badge>パス指定</Badge>;
  }
};
