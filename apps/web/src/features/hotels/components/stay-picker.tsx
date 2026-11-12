"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@booking/ui/components/button";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { toSearchParams } from "../search-params";
import { DateRangeField, type DateRangeValue } from "./date-range-field";

export type Stay = { checkIn?: string; checkOut?: string; guests?: number };

type Props = {
  /** The stay currently in the URL (already validated). */
  value: Stay;
};

const MAX_GUESTS = 20;

function parseGuests(raw: string): number | undefined {
  if (!/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= 1 && n <= MAX_GUESTS ? n : undefined;
}

function stayKey({ checkIn, checkOut, guests }: Stay): string {
  return `${checkIn ?? ""}|${checkOut ?? ""}|${guests ?? ""}`;
}

/**
 * Dates + guests for the detail page. The URL is the source of truth: a complete date range or a
 * valid guest count is written with `router.replace`; a half-picked range stays local until finished.
 */
export function StayPicker({ value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [dates, setDates] = useState<DateRangeValue>({ checkIn: value.checkIn, checkOut: value.checkOut });
  const [guests, setGuests] = useState(value.guests ? String(value.guests) : "");

  // Back/forward or a link changed the URL: follow it. URL changes we wrote ourselves are skipped,
  // so a keystroke typed while a replace is in flight isn't overwritten. (Not a remount — that would
  // steal focus from the guests input on every keystroke.)
  const urlKey = stayKey(value);
  const [syncedKey, setSyncedKey] = useState(urlKey);
  const [writtenKey, setWrittenKey] = useState<string | null>(null);
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey);
    if (urlKey !== writtenKey) {
      setDates({ checkIn: value.checkIn, checkOut: value.checkOut });
      setGuests(value.guests ? String(value.guests) : "");
    }
  }

  const guestsInvalid = guests !== "" && parseGuests(guests) === undefined;

  const write = (next: Stay) => {
    setWrittenKey(stayKey(next));
    const qs = toSearchParams(next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const hasDates = Boolean(value.checkIn && value.checkOut);

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4 text-card-foreground sm:grid-cols-[1fr_8rem_auto] sm:items-start">
      <div className="space-y-2">
        <Label htmlFor="stay-dates">Dates</Label>
        <DateRangeField
          id="stay-dates"
          value={dates}
          onChange={(next) => {
            setDates(next);
            if (next.checkIn && next.checkOut) write({ ...value, ...next });
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="stay-guests">Guests</Label>
        <Input
          id="stay-guests"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_GUESTS}
          placeholder="1"
          value={guests}
          aria-invalid={guestsInvalid || undefined}
          aria-describedby={guestsInvalid ? "stay-guests-error" : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            setGuests(raw);
            if (raw === "") write({ ...value, guests: undefined });
            else {
              const n = parseGuests(raw);
              if (n !== undefined) write({ ...value, guests: n });
            }
          }}
        />
        {guestsInvalid && (
          <p id="stay-guests-error" className="text-sm text-destructive">
            Enter 1 to {MAX_GUESTS} guests
          </p>
        )}
      </div>
      {/* Label-height spacer keeps the button aligned with the fields */}
      <div className="space-y-2">
        <span aria-hidden className="hidden text-sm leading-none sm:block">
          &nbsp;
        </span>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={!hasDates && !dates.checkIn}
          onClick={() => {
            setDates({});
            write({ guests: value.guests });
          }}
        >
          Clear dates
        </Button>
      </div>
    </div>
  );
}
