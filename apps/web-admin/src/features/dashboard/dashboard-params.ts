import { adminDashboardQuerySchema, type AdminDashboardQuery } from "@booking/shared";

const KEYS = ["hotelId", "from", "to"] as const;

/** URL → dashboard query. Invalid values are dropped one by one so a hand-edited URL falls back to defaults. */
export function parseDashboardParams(sp: URLSearchParams): AdminDashboardQuery {
  const raw: Record<string, string> = {};
  for (const key of KEYS) {
    const value = sp.get(key);
    if (value !== null) raw[key] = value;
  }
  for (let pass = 0; pass <= KEYS.length; pass++) {
    const result = adminDashboardQuerySchema.safeParse(raw);
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
  return {};
}

/** Dashboard query → `?…` (empty string for the defaults: all hotels, last 30 nights). */
export function serializeDashboardParams(q: AdminDashboardQuery): string {
  const sp = new URLSearchParams();
  if (q.hotelId) sp.set("hotelId", q.hotelId);
  if (q.from) sp.set("from", q.from);
  if (q.to) sp.set("to", q.to);
  const s = sp.toString();
  return s ? `?${s}` : "";
}
