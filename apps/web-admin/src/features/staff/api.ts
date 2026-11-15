import {
  adminStaffListSchema,
  adminStaffSchema,
  type AdminStaffListQuery,
  type CreateStaffInput,
  type UpdateStaffInput,
} from "@booking/shared";
import { request, requestNoContent } from "@/lib/api";

const staffUrl = (userId: string) => `/api/admin/staff/${encodeURIComponent(userId)}`;

export function fetchStaffList(query: AdminStaffListQuery) {
  return request(adminStaffListSchema, { method: "GET", url: "/api/admin/staff", params: query });
}

export function fetchStaff(userId: string) {
  return request(adminStaffSchema, { method: "GET", url: staffUrl(userId) });
}

export function createStaff(input: CreateStaffInput) {
  return request(adminStaffSchema, { method: "POST", url: "/api/admin/staff", data: input });
}

export function updateStaff(userId: string, input: UpdateStaffInput) {
  return request(adminStaffSchema, { method: "PATCH", url: staffUrl(userId), data: input });
}

export function assignStaffHotel(userId: string, hotelId: string) {
  return request(adminStaffSchema, { method: "POST", url: `${staffUrl(userId)}/hotels`, data: { hotelId } });
}

export function removeStaffHotel(userId: string, hotelId: string) {
  return requestNoContent({
    method: "DELETE",
    url: `${staffUrl(userId)}/hotels/${encodeURIComponent(hotelId)}`,
  });
}
