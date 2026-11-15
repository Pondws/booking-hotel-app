"use client";

import { useState } from "react";
import { BOOKING_TZ, RATE_PERIOD_MAX_NIGHTS, nightsBetween, todayIn } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Calendar } from "@booking/ui/components/calendar";
import { th } from "@booking/ui/lib/calendar-locales";
import { Popover, PopoverContent, PopoverTrigger } from "@booking/ui/components/popover";
import { cn } from "@booking/ui/lib/utils";
import { formatDate, formatDateRange } from "@/features/room-types/format";

export type PeriodRangeValue = { startDate: string; endDate: string };

type Props = {
  value: PeriodRangeValue;
  onChange: (value: PeriodRangeValue) => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
};

// react-day-picker works with local-time Dates; wire dates are plain `YYYY-MM-DD` calendar days.
function toLocalDate(iso: string): Date {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function addDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

// Month captions with the Buddhist-era year, like the rest of the back-office (`เมษายน 2570`)
const captionFormat = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });

function label({ startDate, endDate }: PeriodRangeValue): string {
  if (startDate && endDate) {
    const nights = nightsBetween(startDate, endDate);
    return `${formatDateRange(startDate, endDate)} · ${nights} คืน`;
  }
  if (startDate) return `${formatDate(startDate)} – เลือกวันสิ้นสุด`;
  return "เลือกวันที่";
}

/**
 * Start (first night) → end (first night back at the base price), like check-in / check-out.
 * Any dates are allowed (past periods are history); at most RATE_PERIOD_MAX_NIGHTS nights.
 */
export function PeriodRangeField({ value, onChange, id, invalid, describedBy }: Props) {
  const [open, setOpen] = useState(false);
  const from = value.startDate ? toLocalDate(value.startDate) : undefined;
  const to = value.endDate ? toLocalDate(value.endDate) : undefined;
  const picking = from !== undefined && to === undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn("w-full justify-start font-normal", !value.startDate && "text-muted-foreground")}
        >
          {label(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          locale={th}
          formatters={{ formatCaption: (month) => captionFormat.format(month) }}
          numberOfMonths={2}
          defaultMonth={from ?? toLocalDate(todayIn(BOOKING_TZ))}
          selected={{ from, to }}
          min={1}
          max={RATE_PERIOD_MAX_NIGHTS}
          disabled={
            picking
              ? [{ before: addDays(from, 1) }, { after: addDays(from, RATE_PERIOD_MAX_NIGHTS) }]
              : undefined
          }
          onSelect={(range: { from?: Date; to?: Date } | undefined, clicked: Date) => {
            // A complete range + another click starts a new period on that day
            if (from && to) {
              onChange({ startDate: toIso(clicked), endDate: "" });
              return;
            }
            const next = {
              startDate: range?.from ? toIso(range.from) : "",
              endDate: range?.to ? toIso(range.to) : "",
            };
            onChange(next);
            if (next.startDate && next.endDate) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
