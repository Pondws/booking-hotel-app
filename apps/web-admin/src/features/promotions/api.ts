import { adminPromotionListSchema, adminPromotionSchema, type PromotionInput } from "@booking/shared";
import { request, requestNoContent } from "@/lib/api";

const base = (hotelId: string) => `/api/admin/hotels/${encodeURIComponent(hotelId)}/promotions`;
const one = (hotelId: string, promotionId: string) => `${base(hotelId)}/${encodeURIComponent(promotionId)}`;

export function fetchPromotions(hotelId: string) {
  return request(adminPromotionListSchema, { method: "GET", url: base(hotelId) });
}

export function createPromotion(hotelId: string, input: PromotionInput) {
  return request(adminPromotionSchema, { method: "POST", url: base(hotelId), data: input });
}

export function updatePromotion(hotelId: string, promotionId: string, input: PromotionInput) {
  return request(adminPromotionSchema, { method: "PUT", url: one(hotelId, promotionId), data: input });
}

export function deletePromotion(hotelId: string, promotionId: string) {
  return requestNoContent({ method: "DELETE", url: one(hotelId, promotionId) });
}
