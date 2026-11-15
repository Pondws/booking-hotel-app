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
    new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", ...options }).format(date);
  return { day: get({ day: "numeric" }), month: get({ month: "short" }), year: get({ year: "numeric" }) };
};

/** `12 เม.ย. 2570` (Thai months, Buddhist-era year) */
export function formatDate(iso: string): string {
  const { day, month, year } = parts(iso);
  return `${day} ${month} ${year}`;
}

/** `12 – 15 เม.ย. 2570`, `28 เม.ย. – 2 พ.ค. 2570`, `30 ธ.ค. 2569 – 2 ม.ค. 2570` */
export function formatDateRange(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (a.year !== b.year) return `${formatDate(start)} – ${formatDate(end)}`;
  if (a.month !== b.month) return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`;
  return `${a.day} – ${b.day} ${b.month} ${b.year}`;
}
