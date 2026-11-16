import { dealListSchema, type Deal } from "@booking/shared";
import { request } from "@/lib/api";

export function fetchDeals(): Promise<Deal[]> {
  return request(dealListSchema, { method: "GET", url: "/api/deals" });
}
