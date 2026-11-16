import { Router } from "express";
import {
  adminHotelListQuerySchema,
  createHotelSchema,
  hotelAmenitiesInputSchema,
  hotelContentInputSchema,
  hotelIdParamsSchema,
  hotelImagesInputSchema,
  hotelStatusInputSchema,
  updateHotelSchema,
} from "@booking/shared";
import {
  getAdminHotel,
  listAdminHotels,
  replaceHotelAmenities,
  replaceHotelImages,
  saveHotelContent,
  setHotelStatus,
  updateHotel,
} from "../../controllers/admin-hotel.controller";
import { createHotel } from "../../controllers/hotel.controller";
import { requireHotelAccess } from "../../middleware/require-hotel-access";
import { requireRole } from "../../middleware/require-role";
import { validate } from "../../middleware/validate";
import { adminPromotionsRouter } from "./promotions";
import { adminRoomTypesRouter } from "./room-types";

export const adminHotelsRouter = Router();

adminHotelsRouter.get("/", validate({ query: adminHotelListQuerySchema }), listAdminHotels);

adminHotelsRouter.get(
  "/:hotelId",
  validate({ params: hotelIdParamsSchema }),
  requireHotelAccess(),
  getAdminHotel,
);

adminHotelsRouter.post(
  "/",
  requireRole("ADMIN"),
  validate({ body: createHotelSchema }),
  createHotel,
);

adminHotelsRouter.patch(
  "/:hotelId",
  requireHotelAccess(),
  validate({ params: hotelIdParamsSchema, body: updateHotelSchema }),
  updateHotel,
);

// The admin hotel page saves everything in one form
adminHotelsRouter.put(
  "/:hotelId",
  requireHotelAccess(),
  validate({ params: hotelIdParamsSchema, body: hotelContentInputSchema }),
  saveHotelContent,
);

adminHotelsRouter.put(
  "/:hotelId/images",
  requireHotelAccess(),
  validate({ params: hotelIdParamsSchema, body: hotelImagesInputSchema }),
  replaceHotelImages,
);

adminHotelsRouter.put(
  "/:hotelId/amenities",
  requireHotelAccess(),
  validate({ params: hotelIdParamsSchema, body: hotelAmenitiesInputSchema }),
  replaceHotelAmenities,
);

adminHotelsRouter.use("/:hotelId/room-types", requireHotelAccess(), adminRoomTypesRouter);
adminHotelsRouter.use("/:hotelId/promotions", requireHotelAccess(), adminPromotionsRouter);

adminHotelsRouter.patch(
  "/:hotelId/status",
  requireRole("ADMIN"),
  requireHotelAccess(),
  validate({ params: hotelIdParamsSchema, body: hotelStatusInputSchema }),
  setHotelStatus,
);
