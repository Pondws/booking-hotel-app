/** Money in the API's currency, e.g. `฿3,200`. */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

// `YYYY-MM-DD` wire dates are calendar dates; format them in UTC so the day never shifts.
// One formatter for all three parts: a year formatted alone comes out as `พ.ศ. 2570`, not `2570`.
const dayMonthYear = new Intl.DateTimeFormat("th-TH", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const parts = (iso: string) => {
  const found = dayMonthYear.formatToParts(new Date(`${iso}T00:00:00.000Z`));
  const get = (type: Intl.DateTimeFormatPartTypes) => found.find((p) => p.type === type)?.value ?? "";
  return { day: get("day"), month: get("month"), year: get("year") };
};

/** `12 เม.ย. 2570` (Thai months, Buddhist-era year) */
export function formatDate(iso: string): string {
  const { day, month, year } = parts(iso);
  return `${day} ${month} ${year}`;
}

/** `เม.ย. 2570` */
export function formatMonthYear(iso: string): string {
  const { month, year } = parts(iso);
  return `${month} ${year}`;
}

/** `12 – 15 เม.ย. 2570`, `28 เม.ย. – 2 พ.ค. 2570`, `30 ธ.ค. 2569 – 2 ม.ค. 2570` */
export function formatDateRange(checkIn: string, checkOut: string): string {
  const a = parts(checkIn);
  const b = parts(checkOut);
  if (a.year !== b.year) return `${formatDate(checkIn)} – ${formatDate(checkOut)}`;
  if (a.month !== b.month) return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`;
  return `${a.day} – ${b.day} ${b.month} ${b.year}`;
}

/** `3 คืน` */
export const nightsLabel = (n: number) => `${n} คืน`;

/** `2 คน` */
export const guestsLabel = (n: number) => `${n} คน`;

/** `128 รีวิว`, or "ยังไม่มีรีวิว" */
export const reviewsLabel = (n: number) => (n === 0 ? "ยังไม่มีรีวิว" : `${n.toLocaleString("th-TH")} รีวิว`);

/** Booking.com-style word for a 1–5 average. */
export function ratingWord(avg: number): string {
  if (avg >= 4.5) return "ยอดเยี่ยม";
  if (avg >= 4) return "ดีมาก";
  if (avg >= 3.5) return "ดี";
  if (avg >= 3) return "พอใช้";
  return "ควรปรับปรุง";
}
