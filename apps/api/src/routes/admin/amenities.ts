import { Router } from "express";
import { amenityListQuerySchema } from "@booking/shared";
import { listAmenities } from "../../controllers/admin-hotel.controller";
import { validate } from "../../middleware/validate";

export const adminAmenitiesRouter = Router();

adminAmenitiesRouter.get("/", validate({ query: amenityListQuerySchema }), listAmenities);
