import { hotelListSchema, hotelSchema, type CreateHotelInput } from "@booking/shared";
import { request } from "@/lib/api";

export function fetchHotels() {
  return request(hotelListSchema, { method: "GET", url: "/api/hotels" });
}

export function createHotel(input: CreateHotelInput) {
  return request(hotelSchema, { method: "POST", url: "/api/admin/hotels", data: input });
}
