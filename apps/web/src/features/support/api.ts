import {
  supportRequestListSchema,
  supportRequestSchema,
  type CreateSupportRequestData,
  type SupportRequest,
} from "@booking/shared";
import { request } from "@/lib/api";

const url = (code: string) => `/api/bookings/${encodeURIComponent(code)}/support-requests`;

export function fetchSupportRequests(code: string): Promise<SupportRequest[]> {
  return request(supportRequestListSchema, { method: "GET", url: url(code) });
}

export function createSupportRequest(code: string, input: CreateSupportRequestData): Promise<SupportRequest> {
  return request(supportRequestSchema, { method: "POST", url: url(code), data: input });
}
