import { hotelSchema, hotelSearchResultSchema, type CreateHotelInput } from "@booking/shared";
import { request } from "@/lib/api";

// Reuses the public search endpoint until Phase 6 adds an admin list.
export async function fetchHotels() {
  const result = await request(hotelSearchResultSchema, {
    method: "GET",
    url: "/api/hotels",
    params: { pageSize: 50 },
  });
  return result.items;
}

export function createHotel(input: CreateHotelInput) {
  return request(hotelSchema, { method: "POST", url: "/api/admin/hotels", data: input });
}
