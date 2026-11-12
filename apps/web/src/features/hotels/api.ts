import { hotelListSchema } from "@booking/shared";
import { request } from "@/lib/api";

export function fetchHotels() {
  return request(hotelListSchema, { method: "GET", url: "/api/hotels" });
}
