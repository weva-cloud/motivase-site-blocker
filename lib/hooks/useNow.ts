import { useEffect, useState } from "react";

/** カウントダウン表示用に一定間隔で現在時刻（epoch ms）を返す */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
