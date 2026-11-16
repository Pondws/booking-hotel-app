"use client";

const HOUR_MINUTE = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" });
const ONE_MINUTE_MS = 60_000;

function mmss(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Props = { expiresAt: string; remainingMs: number; done: boolean; settled: boolean };

export function HoldCountdown({ expiresAt, remainingMs, done, settled }: Props) {
  const lastMinute = remainingMs > 0 && remainingMs <= ONE_MINUTE_MS;
  return (
    <div className="space-y-1 rounded-xl border bg-secondary p-4 text-secondary-foreground">
      <p className="text-sm">
        ระบบกันห้องไว้ให้ถึงเวลา{" "}
        <span className="font-medium tabular-nums">{HOUR_MINUTE.format(new Date(expiresAt))}</span>
      </p>
      <p className="flex items-baseline gap-2">
        <span
          role="timer"
          aria-label="เวลาที่เหลือในการชำระเงิน"
          className="font-mono text-3xl font-semibold tabular-nums"
        >
          {mmss(remainingMs)}
        </span>
        <span className="text-sm opacity-80">{done ? (settled ? "กำลังหมดเวลา…" : "กำลังตรวจสอบสถานะ…") : "เหลือเวลาชำระเงิน"}</span>
      </p>
      {/* Announced once, when the last minute starts */}
      <p aria-live="polite" className="sr-only">
        {lastMinute ? "เหลือเวลาชำระเงินอีก 1 นาที" : ""}
      </p>
    </div>
  );
}
