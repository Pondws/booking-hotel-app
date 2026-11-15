import { Router } from "express";
import {
  amenityIdParamsSchema,
  amenityListQuerySchema,
  createAmenitySchema,
  updateAmenitySchema,
} from "@booking/shared";
import {
  createAmenity,
  deleteAmenity,
  getAmenity,
  listAmenities,
  updateAmenity,
} from "../../controllers/amenity.controller";
import { requireRole } from "../../middleware/require-role";
import { validate } from "../../middleware/validate";

/** `/api/admin/amenities` — ADMIN + STAFF read the options (hotel / room type forms); only ADMIN writes. */
export const adminAmenitiesRouter = Router();

adminAmenitiesRouter.get("/", validate({ query: amenityListQuerySchema }), listAmenities);

adminAmenitiesRouter.post("/", requireRole("ADMIN"), validate({ body: createAmenitySchema }), createAmenity);

adminAmenitiesRouter.get("/:amenityId", requireRole("ADMIN"), validate({ params: amenityIdParamsSchema }), getAmenity);

adminAmenitiesRouter.patch(
  "/:amenityId",
  requireRole("ADMIN"),
  validate({ params: amenityIdParamsSchema, body: updateAmenitySchema }),
  updateAmenity,
);

adminAmenitiesRouter.delete(
  "/:amenityId",
  requireRole("ADMIN"),
  validate({ params: amenityIdParamsSchema }),
  deleteAmenity,
);
