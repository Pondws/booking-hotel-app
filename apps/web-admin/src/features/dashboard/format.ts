// `YYYY-MM-DD` wire dates are calendar dates; format in UTC so the day never shifts.
const dayMonth = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });
const percent = new Intl.NumberFormat("th-TH", { style: "percent", maximumFractionDigits: 0 });

/** `12 พ.ย.` — chart axis ticks. */
export function formatShortDate(iso: string): string {
  return dayMonth.format(new Date(`${iso}T00:00:00.000Z`));
}

/** `75%`, or `–` when there is no sellable room. */
export function formatRate(rate: number | null): string {
  return rate === null ? "–" : percent.format(rate);
}

/** 0 … ≥ `max` in about four even steps of 1, 2, 2.5 or 5 × 10ⁿ (e.g. 2500 → 0, 1000, 2000, 3000). */
export function niceTicks(max: number, steps = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / steps;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const count = Math.ceil(max / step - 1e-9);
  return Array.from({ length: count + 1 }, (_, i) => Number((i * step).toPrecision(12)));
}
