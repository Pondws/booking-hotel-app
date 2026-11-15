import { Router } from "express";
import { adminHotelListQuerySchema, createHotelSchema, hotelIdParamsSchema } from "@booking/shared";
import { getAdminHotel, listAdminHotels } from "../../controllers/admin-hotel.controller";
import { createHotel } from "../../controllers/hotel.controller";
import { requireHotelAccess } from "../../middleware/require-hotel-access";
import { requireRole } from "../../middleware/require-role";
import { validate } from "../../middleware/validate";

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
