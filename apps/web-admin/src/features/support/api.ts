import {
  adminSupportRequestListSchema,
  adminSupportRequestSchema,
  type AdminSupportListQuery,
  type ResolveSupportRequestData,
} from "@booking/shared";
import { request } from "@/lib/api";

export function fetchSupportRequests(query: AdminSupportListQuery) {
  return request(adminSupportRequestListSchema, { method: "GET", url: "/api/admin/support-requests", params: query });
}

export function resolveSupportRequest(id: string, input: ResolveSupportRequestData) {
  return request(adminSupportRequestSchema, {
    method: "POST",
    url: `/api/admin/support-requests/${encodeURIComponent(id)}/resolve`,
    data: input,
  });
}
