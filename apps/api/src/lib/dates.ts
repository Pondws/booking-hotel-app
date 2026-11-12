/**
 * `@db.Date` columns ↔ `YYYY-MM-DD` strings. Calendar dates are stored as UTC midnight,
 * so all arithmetic here is in UTC days.
 */
export function toDbDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function fromDbDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Every night in `[checkIn, checkOut)` as `YYYY-MM-DD`. */
export function eachNight(checkIn: string, checkOut: string): string[] {
  const nights: string[] = [];
  const d = toDbDate(checkIn);
  const end = toDbDate(checkOut);
  while (d < end) {
    nights.push(fromDbDate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return nights;
}
