"use client";

import { useEffect, useState } from "react";

/**
 * Time left until `expiresAt`, ticking once a second. Clamped at 0; the interval is cleared
 * once it gets there. `null` (nothing to count down) is never `done`.
 */
export function useCountdown(expiresAt: string | null): { remainingMs: number; done: boolean } {
  const target = expiresAt === null ? null : Date.parse(expiresAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target === null) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= target) clearInterval(id);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (target === null) return { remainingMs: 0, done: false };
  const remainingMs = Math.max(0, target - now);
  return { remainingMs, done: remainingMs === 0 };
}
