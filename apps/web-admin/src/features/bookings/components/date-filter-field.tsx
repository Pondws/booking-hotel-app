"use client";

import { useState } from "react";
import { BOOKING_TZ, todayIn } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Calendar } from "@booking/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@booking/ui/components/popover";
import { th } from "@booking/ui/lib/calendar-locales";
import { cn } from "@booking/ui/lib/utils";
import { formatDate, formatDateRange } from "@/features/room-types/format";

export type DateFilterValue = { from?: string; to?: string };

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

const captionFormat = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });

function label({ from, to }: DateFilterValue): string {
  if (from && to) return from === to ? formatDate(from) : formatDateRange(from, to);
  if (from) return `ตั้งแต่ ${formatDate(from)}`;
  if (to) return `ถึง ${formatDate(to)}`;
  return "ทุกวันที่";
}

/**
 * Days the stay touches, both ends inclusive (one day = guests in house that day, arrivals included).
 * Applies once both ends are picked; "Clear" removes the filter.
 */
export function DateFilterField({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from?: Date; to?: Date } | undefined>();
  const selected = draft ?? {
    from: value.from ? toLocalDate(value.from) : undefined,
    to: value.to ? toLocalDate(value.to) : undefined,
  };
  const hasValue = value.from !== undefined || value.to !== undefined;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setDraft(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn("w-56 justify-start font-normal", !hasValue && "text-muted-foreground")}
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
          defaultMonth={selected.from ?? toLocalDate(todayIn(BOOKING_TZ))}
          selected={{ from: selected.from, to: selected.to }}
          onSelect={(_range: unknown, clicked: Date) => {
            // First click starts the range; the second ends it (the same day twice = that one day)
            if (!draft?.from) {
              setDraft({ from: clicked });
              return;
            }
            const [from, to] = draft.from <= clicked ? [draft.from, clicked] : [clicked, draft.from];
            onChange({ from: toIso(from), to: toIso(to) });
            setDraft(undefined);
            setOpen(false);
          }}
        />
        <div className="flex justify-between gap-2 border-t p-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const today = todayIn(BOOKING_TZ);
              onChange({ from: today, to: today });
              setOpen(false);
            }}
          >
            วันนี้
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasValue}
            onClick={() => {
              onChange({});
              setOpen(false);
            }}
          >
            ล้าง
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
