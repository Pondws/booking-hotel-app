import {
  adminAmenityListSchema,
  adminAmenitySchema,
  type AmenityScope,
  type CreateAmenityInput,
  type UpdateAmenityInput,
} from "@booking/shared";
import { request, requestNoContent } from "@/lib/api";

/** Options + usage counts (STAFF can read it too; the forms only use the option fields). */
export function fetchAmenities(scope?: AmenityScope) {
  return request(adminAmenityListSchema, {
    method: "GET",
    url: "/api/admin/amenities",
    params: scope ? { scope } : undefined,
  });
}

export function createAmenity(input: CreateAmenityInput) {
  return request(adminAmenitySchema, { method: "POST", url: "/api/admin/amenities", data: input });
}

export function updateAmenity(id: string, input: UpdateAmenityInput) {
  return request(adminAmenitySchema, {
    method: "PATCH",
    url: `/api/admin/amenities/${encodeURIComponent(id)}`,
    data: input,
  });
}

export function deleteAmenity(id: string) {
  return requestNoContent({ method: "DELETE", url: `/api/admin/amenities/${encodeURIComponent(id)}` });
}
