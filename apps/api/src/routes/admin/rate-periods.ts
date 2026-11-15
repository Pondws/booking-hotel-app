import { Router } from "express";
import { ratePeriodInputSchema, ratePeriodParamsSchema, roomTypeParamsSchema } from "@booking/shared";
import {
  createRatePeriod,
  deleteRatePeriod,
  listRatePeriods,
  updateRatePeriod,
} from "../../controllers/admin-rate-period.controller";
import { validate } from "../../middleware/validate";

/**
 * `/api/admin/hotels/:hotelId/room-types/:roomTypeId/rate-periods` — mounted in `room-types.ts`, so behind
 * `requireHotelAccess()`. Services 404 a room type outside the hotel / a period outside the room type.
 */
export const adminRatePeriodsRouter = Router({ mergeParams: true });

adminRatePeriodsRouter.get("/", validate({ params: roomTypeParamsSchema }), listRatePeriods);

adminRatePeriodsRouter.post(
  "/",
  validate({ params: roomTypeParamsSchema, body: ratePeriodInputSchema }),
  createRatePeriod,
);

adminRatePeriodsRouter.put(
  "/:ratePeriodId",
  validate({ params: ratePeriodParamsSchema, body: ratePeriodInputSchema }),
  updateRatePeriod,
);

adminRatePeriodsRouter.delete("/:ratePeriodId", validate({ params: ratePeriodParamsSchema }), deleteRatePeriod);
