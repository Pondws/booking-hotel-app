import { adminDashboardSchema, type AdminDashboardQuery } from "@booking/shared";
import { request } from "@/lib/api";

export function fetchAdminDashboard(query: AdminDashboardQuery) {
  return request(adminDashboardSchema, { method: "GET", url: "/api/admin/dashboard", params: query });
}
