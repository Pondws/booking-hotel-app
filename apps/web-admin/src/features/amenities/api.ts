import { amenityOptionListSchema, type AmenityScope } from "@booking/shared";
import { request } from "@/lib/api";

export function fetchAmenities(scope?: AmenityScope) {
  return request(amenityOptionListSchema, {
    method: "GET",
    url: "/api/admin/amenities",
    params: scope ? { scope } : undefined,
  });
}
