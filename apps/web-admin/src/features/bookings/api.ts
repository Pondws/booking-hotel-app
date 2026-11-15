import {
  adminBookingListSchema,
  adminBookingRoomOptionListSchema,
  adminBookingSchema,
  type AdminBookingListQuery,
  type CancelBookingInput,
} from "@booking/shared";
import { request } from "@/lib/api";

const one = (code: string) => `/api/admin/bookings/${encodeURIComponent(code)}`;

export function fetchAdminBookings(query: AdminBookingListQuery) {
  return request(adminBookingListSchema, { method: "GET", url: "/api/admin/bookings", params: query });
}

export function fetchAdminBooking(code: string) {
  return request(adminBookingSchema, { method: "GET", url: one(code) });
}

export function fetchBookingRoomOptions(code: string) {
  return request(adminBookingRoomOptionListSchema, { method: "GET", url: `${one(code)}/rooms` });
}

export function checkInBooking(code: string) {
  return request(adminBookingSchema, { method: "POST", url: `${one(code)}/check-in` });
}

export function checkOutBooking(code: string) {
  return request(adminBookingSchema, { method: "POST", url: `${one(code)}/check-out` });
}

export function cancelBooking(code: string, input: CancelBookingInput) {
  return request(adminBookingSchema, { method: "POST", url: `${one(code)}/cancel`, data: input });
}

export function moveBookingRoom(code: string, roomId: string) {
  return request(adminBookingSchema, { method: "PUT", url: `${one(code)}/room`, data: { roomId } });
}
