import { adminSupportListQuerySchema, type AdminSupportListQuery } from "@booking/shared";

const KEYS = ["hotelId", "status", "page", "pageSize"] as const;
const DEFAULTS = adminSupportListQuerySchema.parse({});

/** URL → list query. Invalid values are dropped one by one so a hand-edited URL falls back to defaults. */
export function parseListParams(sp: URLSearchParams): AdminSupportListQuery {
  const raw: Record<string, string> = {};
  for (const key of KEYS) {
    const value = sp.get(key);
    if (value !== null) raw[key] = value;
  }
  for (let pass = 0; pass <= KEYS.length; pass++) {
    const result = adminSupportListQuerySchema.safeParse(raw);
    if (result.success) return result.data;
    let dropped = false;
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && key in raw) {
        delete raw[key];
        dropped = true;
      }
    }
    if (!dropped) break;
  }
  return DEFAULTS;
}

/** List query → `?…` (empty string when everything is default). */
export function serializeListParams(q: Partial<AdminSupportListQuery>): string {
  const sp = new URLSearchParams();
  if (q.hotelId) sp.set("hotelId", q.hotelId);
  if (q.status && q.status !== DEFAULTS.status) sp.set("status", q.status);
  if (q.page !== undefined && q.page !== DEFAULTS.page) sp.set("page", String(q.page));
  if (q.pageSize !== undefined && q.pageSize !== DEFAULTS.pageSize) sp.set("pageSize", String(q.pageSize));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
