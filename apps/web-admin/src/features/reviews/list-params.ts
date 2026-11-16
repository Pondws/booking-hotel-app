import { adminReviewListQuerySchema, type AdminReviewListQuery } from "@booking/shared";

const KEYS = ["hotelId", "visibility", "page", "pageSize"] as const;
const DEFAULTS = adminReviewListQuerySchema.parse({});

/** URL → list query. Invalid values are dropped one by one so a hand-edited URL falls back to defaults. */
export function parseListParams(sp: URLSearchParams): AdminReviewListQuery {
  const raw: Record<string, string> = {};
  for (const key of KEYS) {
    const value = sp.get(key);
    if (value !== null) raw[key] = value;
  }
  for (let pass = 0; pass <= KEYS.length; pass++) {
    const result = adminReviewListQuerySchema.safeParse(raw);
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
export function serializeListParams(q: Partial<AdminReviewListQuery>): string {
  const sp = new URLSearchParams();
  if (q.hotelId) sp.set("hotelId", q.hotelId);
  if (q.visibility && q.visibility !== DEFAULTS.visibility) sp.set("visibility", q.visibility);
  if (q.page !== undefined && q.page !== DEFAULTS.page) sp.set("page", String(q.page));
  if (q.pageSize !== undefined && q.pageSize !== DEFAULTS.pageSize) sp.set("pageSize", String(q.pageSize));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
