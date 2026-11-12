import { Router } from "express";
import { createHotelSchema } from "@booking/shared";
import { createHotel } from "../../controllers/hotel.controller";
import { requireRole } from "../../middleware/require-role";
import { validate } from "../../middleware/validate";

export const adminHotelsRouter = Router();

adminHotelsRouter.post(
  "/",
  requireRole("ADMIN"),
  validate({ body: createHotelSchema }),
  createHotel,
);
