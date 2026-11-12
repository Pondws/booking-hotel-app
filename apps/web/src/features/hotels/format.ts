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
const parts = (iso: string) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  const get = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(date);
  return { day: get({ day: "numeric" }), month: get({ month: "short" }), year: get({ year: "numeric" }) };
};

/** `12 Apr 2027` */
export function formatDate(iso: string): string {
  const { day, month, year } = parts(iso);
  return `${day} ${month} ${year}`;
}

/** `12 – 15 Apr 2027`, `28 Apr – 2 May 2027`, `30 Dec 2026 – 2 Jan 2027` */
export function formatDateRange(checkIn: string, checkOut: string): string {
  const a = parts(checkIn);
  const b = parts(checkOut);
  if (a.year !== b.year) return `${formatDate(checkIn)} – ${formatDate(checkOut)}`;
  if (a.month !== b.month) return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`;
  return `${a.day} – ${b.day} ${b.month} ${b.year}`;
}
