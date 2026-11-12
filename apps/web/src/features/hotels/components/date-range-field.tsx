"use client";

import { useState } from "react";
import { BOOKING_TZ, MAX_NIGHTS, todayIn } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Calendar } from "@booking/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@booking/ui/components/popover";
import { cn } from "@booking/ui/lib/utils";
import { formatDateRange, formatDate } from "../format";

export type DateRangeValue = { checkIn?: string; checkOut?: string };

type Props = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
};

// react-day-picker works with local-time Dates; wire dates are plain `YYYY-MM-DD` calendar days.
function toLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
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

function label({ checkIn, checkOut }: DateRangeValue): string {
  if (checkIn && checkOut) return formatDateRange(checkIn, checkOut);
  if (checkIn) return `${formatDate(checkIn)} – check-out?`;
  return "Add dates";
}

/** Check-in/check-out picker: past days (Bangkok time) and stays over MAX_NIGHTS can't be picked. */
export function DateRangeField({ value, onChange, id, invalid, describedBy, className }: Props) {
  const [open, setOpen] = useState(false);
  const empty = !value.checkIn;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn("w-full justify-start font-normal", empty && "text-muted-foreground", className)}
        >
          {label(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {/* Rendered only while open, so "today" is read on the client at pick time */}
        <RangeCalendar
          value={value}
          onChange={(next) => {
            onChange(next);
            if (next.checkIn && next.checkOut) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function RangeCalendar({ value, onChange }: Pick<Props, "value" | "onChange">) {
  const today = toLocalDate(todayIn(BOOKING_TZ));
  const from = value.checkIn ? toLocalDate(value.checkIn) : undefined;
  const to = value.checkOut ? toLocalDate(value.checkOut) : undefined;
  const picking = from !== undefined && to === undefined;

  return (
    <Calendar
      mode="range"
      numberOfMonths={2}
      defaultMonth={from ?? today}
      selected={{ from, to }}
      min={1}
      max={MAX_NIGHTS}
      disabled={picking ? [{ before: today }, { after: addDays(from, MAX_NIGHTS) }] : { before: today }}
      onSelect={(range: { from?: Date; to?: Date } | undefined, clicked: Date) => {
        // A complete range + another click starts a new stay on that day. (react-day-picker would
        // stretch the old range to it and close the picker on a stay nobody chose.)
        if (from && to) {
          onChange({ checkIn: toIso(clicked), checkOut: undefined });
          return;
        }
        onChange({
          checkIn: range?.from ? toIso(range.from) : undefined,
          checkOut: range?.to ? toIso(range.to) : undefined,
        });
      }}
    />
  );
}
