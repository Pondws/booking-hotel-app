import {
  adminHotelListSchema,
  adminHotelSchema,
  type AdminHotelListQuery,
  type CreateHotelInput,
  type HotelContentInput,
} from "@booking/shared";
import { request } from "@/lib/api";

export function fetchAdminHotels(query: AdminHotelListQuery) {
  return request(adminHotelListSchema, { method: "GET", url: "/api/admin/hotels", params: query });
}

export function fetchAdminHotel(id: string) {
  return request(adminHotelSchema, { method: "GET", url: `/api/admin/hotels/${encodeURIComponent(id)}` });
}

export function createHotel(input: CreateHotelInput) {
  return request(adminHotelSchema, { method: "POST", url: "/api/admin/hotels", data: input });
}

/** Saves details, times, images and amenities together (all or nothing). */
export function saveHotel(id: string, input: HotelContentInput) {
  return request(adminHotelSchema, {
    method: "PUT",
    url: `/api/admin/hotels/${encodeURIComponent(id)}`,
    data: input,
  });
}

export function setHotelStatus(id: string, isActive: boolean) {
  return request(adminHotelSchema, {
    method: "PATCH",
    url: `/api/admin/hotels/${encodeURIComponent(id)}/status`,
    data: { isActive },
  });
}
