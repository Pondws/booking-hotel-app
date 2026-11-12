import { hotelSearchQuerySchema, stayRangeSchema } from "@booking/shared";
import { Router } from "express";
import { z } from "zod";
import { getAvailability, getHotel, searchHotels } from "../controllers/hotel.controller";
import { validate } from "../middleware/validate";

export const hotelsRouter = Router();

const slugParams = z.object({ slug: z.string().min(1).max(200) });

hotelsRouter.get("/", validate({ query: hotelSearchQuerySchema }), searchHotels);
hotelsRouter.get("/:slug", validate({ params: slugParams }), getHotel);
hotelsRouter.get(
  "/:slug/availability",
  validate({ params: slugParams, query: stayRangeSchema }),
  getAvailability,
);
