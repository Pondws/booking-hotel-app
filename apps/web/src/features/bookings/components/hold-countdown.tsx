"use client";

const HOUR_MINUTE = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const ONE_MINUTE_MS = 60_000;

function mmss(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Props = { expiresAt: string; remainingMs: number; done: boolean };

export function HoldCountdown({ expiresAt, remainingMs, done }: Props) {
  const lastMinute = remainingMs > 0 && remainingMs <= ONE_MINUTE_MS;
  return (
    <div className="space-y-1 rounded-lg border p-4">
      <p className="text-sm">
        Your room is held until{" "}
        <span className="font-medium tabular-nums">{HOUR_MINUTE.format(new Date(expiresAt))}</span>
      </p>
      <p className="flex items-baseline gap-2">
        <span
          role="timer"
          aria-label="Time left on your hold"
          className="font-mono text-3xl font-semibold tabular-nums"
        >
          {mmss(remainingMs)}
        </span>
        <span className="text-sm text-muted-foreground">{done ? "Checking your hold…" : "remaining"}</span>
      </p>
      {/* Announced once, when the last minute starts */}
      <p aria-live="polite" className="sr-only">
        {lastMinute ? "One minute left on your hold." : ""}
      </p>
    </div>
  );
}
