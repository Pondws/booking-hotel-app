import { hotelSearchQuerySchema, type HotelSearchQuery } from "@booking/shared";

const KEYS = ["city", "checkIn", "checkOut", "guests", "page", "pageSize"] as const;
type Key = (typeof KEYS)[number];

const DEFAULTS = hotelSearchQuerySchema.parse({});

function isKey(value: unknown): value is Key {
  return typeof value === "string" && (KEYS as readonly string[]).includes(value);
}

/**
 * URL → search query. Invalid values are dropped (dates as a pair) and the rest re-parsed,
 * so a hand-edited URL falls back to defaults instead of throwing.
 */
export function parseSearchParams(sp: URLSearchParams): HotelSearchQuery {
  const raw: Partial<Record<Key, string>> = {};
  for (const key of KEYS) {
    const value = sp.get(key);
    if (value !== null) raw[key] = value;
  }

  // Each pass removes at least one key, so this ends after at most KEYS.length passes
  for (let pass = 0; pass <= KEYS.length; pass++) {
    const result = hotelSearchQuerySchema.safeParse(raw);
    if (result.success) return result.data;
    let dropped = false;
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (!isKey(key)) continue;
      const keys: Key[] = key === "checkIn" || key === "checkOut" ? ["checkIn", "checkOut"] : [key];
      for (const k of keys) {
        if (k in raw) {
          delete raw[k];
          dropped = true;
        }
      }
    }
    if (!dropped) break;
  }
  return DEFAULTS;
}

/** Search query → URL params, leaving out empty values and defaults (page 1, default page size). */
export function toSearchParams(q: Partial<HotelSearchQuery>): URLSearchParams {
  const sp = new URLSearchParams();
  if (q.city) sp.set("city", q.city);
  if (q.checkIn && q.checkOut) {
    sp.set("checkIn", q.checkIn);
    sp.set("checkOut", q.checkOut);
  }
  if (q.guests !== undefined) sp.set("guests", String(q.guests));
  if (q.page !== undefined && q.page !== DEFAULTS.page) sp.set("page", String(q.page));
  if (q.pageSize !== undefined && q.pageSize !== DEFAULTS.pageSize) {
    sp.set("pageSize", String(q.pageSize));
  }
  return sp;
}

/** `/hotels` URL for a query (no trailing `?` when nothing is set). */
export function searchHref(q: Partial<HotelSearchQuery>): string {
  const qs = toSearchParams(q).toString();
  return qs ? `/hotels?${qs}` : "/hotels";
}
