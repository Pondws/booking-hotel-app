import { adminStaffListQuerySchema, type AdminStaffListQuery } from "@booking/shared";

const DEFAULTS = adminStaffListQuerySchema.parse({});

/** URL → list query. An invalid value falls back to its default. */
export function parseListParams(sp: URLSearchParams): AdminStaffListQuery {
  const q = adminStaffListQuerySchema.shape.q.safeParse(sp.get("q") ?? undefined);
  const page = adminStaffListQuerySchema.shape.page.safeParse(sp.get("page") ?? undefined);
  const pageSize = adminStaffListQuerySchema.shape.pageSize.safeParse(sp.get("pageSize") ?? undefined);
  return {
    q: q.success ? q.data : undefined,
    page: page.success ? page.data : DEFAULTS.page,
    pageSize: pageSize.success ? pageSize.data : DEFAULTS.pageSize,
  };
}

/** List query → `?…` (empty string when everything is default). */
export function serializeListParams(q: Partial<AdminStaffListQuery>): string {
  const sp = new URLSearchParams();
  if (q.q) sp.set("q", q.q);
  if (q.page !== undefined && q.page !== DEFAULTS.page) sp.set("page", String(q.page));
  if (q.pageSize !== undefined && q.pageSize !== DEFAULTS.pageSize) sp.set("pageSize", String(q.pageSize));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
