import { formatRemainingJa } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";

/** 失効時刻までの残り時間を「あとn分n秒」で表示する */
export const Countdown = ({
  until,
  className = "",
}: {
  until: number;
  className?: string;
}) => {
  const now = useNow(250);
  return (
    <span className={`tabular-nums ${className}`}>{formatRemainingJa(until - now)}</span>
  );
};
