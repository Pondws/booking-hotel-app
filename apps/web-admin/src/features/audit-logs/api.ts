import { adminAuditLogListSchema, type AdminAuditLogListQuery } from "@booking/shared";
import { request } from "@/lib/api";

export function fetchAuditLogs(query: AdminAuditLogListQuery) {
  return request(adminAuditLogListSchema, { method: "GET", url: "/api/admin/audit-logs", params: query });
}
