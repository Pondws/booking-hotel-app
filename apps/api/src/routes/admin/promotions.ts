import { Router } from "express";
import { hotelIdParamsSchema, promotionInputSchema, promotionParamsSchema } from "@booking/shared";
import {
  createPromotion,
  deletePromotion,
  listPromotions,
  updatePromotion,
} from "../../controllers/admin-promotion.controller";
import { validate } from "../../middleware/validate";

/**
 * `/api/admin/hotels/:hotelId/promotions` — mounted in `hotels.ts` behind `requireHotelAccess()`.
 * The service 404s a promotion of another hotel.
 */
export const adminPromotionsRouter = Router({ mergeParams: true });

adminPromotionsRouter.get("/", validate({ params: hotelIdParamsSchema }), listPromotions);
adminPromotionsRouter.post(
  "/",
  validate({ params: hotelIdParamsSchema, body: promotionInputSchema }),
  createPromotion,
);
adminPromotionsRouter.put(
  "/:promotionId",
  validate({ params: promotionParamsSchema, body: promotionInputSchema }),
  updatePromotion,
);
adminPromotionsRouter.delete("/:promotionId", validate({ params: promotionParamsSchema }), deletePromotion);
