import { adminRatePeriodListSchema, adminRatePeriodSchema, type RatePeriodInput } from "@booking/shared";
import { request, requestNoContent } from "@/lib/api";

const base = (hotelId: string, roomTypeId: string) =>
  `/api/admin/hotels/${encodeURIComponent(hotelId)}/room-types/${encodeURIComponent(roomTypeId)}/rate-periods`;
const one = (hotelId: string, roomTypeId: string, ratePeriodId: string) =>
  `${base(hotelId, roomTypeId)}/${encodeURIComponent(ratePeriodId)}`;

export function fetchRatePeriods(hotelId: string, roomTypeId: string) {
  return request(adminRatePeriodListSchema, { method: "GET", url: base(hotelId, roomTypeId) });
}

export function createRatePeriod(hotelId: string, roomTypeId: string, input: RatePeriodInput) {
  return request(adminRatePeriodSchema, { method: "POST", url: base(hotelId, roomTypeId), data: input });
}

export function updateRatePeriod(
  hotelId: string,
  roomTypeId: string,
  ratePeriodId: string,
  input: RatePeriodInput,
) {
  return request(adminRatePeriodSchema, {
    method: "PUT",
    url: one(hotelId, roomTypeId, ratePeriodId),
    data: input,
  });
}

export function deleteRatePeriod(hotelId: string, roomTypeId: string, ratePeriodId: string) {
  return requestNoContent({ method: "DELETE", url: one(hotelId, roomTypeId, ratePeriodId) });
}
