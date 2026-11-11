import { useEffect, useState } from 'react';

/**
 * The time, re-read every minute while `active` (plan 130: the "Cancels at" tag appears by itself in
 * the last 2 hours). Inactive rows keep the time they were drawn at and set no timer.
 */
export function useMinuteNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}
