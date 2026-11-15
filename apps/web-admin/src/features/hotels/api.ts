import {
  adminHotelListSchema,
  adminHotelSchema,
  type AdminHotelListQuery,
  type CreateHotelInput,
  type HotelAmenitiesInput,
  type HotelImagesInput,
  type UpdateHotelInput,
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

export function updateHotel(id: string, input: UpdateHotelInput) {
  return request(adminHotelSchema, {
    method: "PATCH",
    url: `/api/admin/hotels/${encodeURIComponent(id)}`,
    data: input,
  });
}

export function replaceHotelImages(id: string, input: HotelImagesInput) {
  return request(adminHotelSchema, {
    method: "PUT",
    url: `/api/admin/hotels/${encodeURIComponent(id)}/images`,
    data: input,
  });
}

export function replaceHotelAmenities(id: string, input: HotelAmenitiesInput) {
  return request(adminHotelSchema, {
    method: "PUT",
    url: `/api/admin/hotels/${encodeURIComponent(id)}/amenities`,
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
