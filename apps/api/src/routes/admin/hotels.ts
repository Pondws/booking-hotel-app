import { Router } from "express";
import { createHotelSchema } from "@booking/shared";
import { createHotel } from "../../controllers/hotel.controller";
import { validate } from "../../middleware/validate";

export const adminHotelsRouter = Router();

adminHotelsRouter.post("/", validate({ body: createHotelSchema }), createHotel);
