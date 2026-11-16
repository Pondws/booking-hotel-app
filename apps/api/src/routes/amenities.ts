import { Router } from "express";
import { listHotelAmenities } from "../controllers/amenity.controller";

/** `/api/amenities` — public, read-only (the admin catalog lives under `/api/admin/amenities`). */
export const amenitiesRouter = Router();

amenitiesRouter.get("/", listHotelAmenities);
