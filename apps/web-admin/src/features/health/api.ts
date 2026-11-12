import { healthSchema } from "@booking/shared";
import { request } from "@/lib/api";

/** 503 (DB down) is a valid health payload, not an error. */
export function fetchHealth() {
  return request(healthSchema, {
    method: "GET",
    url: "/api/health",
    validateStatus: (s) => s === 200 || s === 503,
  });
}
