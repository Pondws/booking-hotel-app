import { hotelSearchResultSchema } from "@booking/shared";
import { request } from "@/lib/api";

// Stopgap until the search fetchers land (phase 3, task 6).
export async function fetchHotels() {
  const result = await request(hotelSearchResultSchema, { method: "GET", url: "/api/hotels" });
  return result.items;
}
