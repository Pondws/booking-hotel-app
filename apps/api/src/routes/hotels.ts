import { Router } from "express";
import { createHotelSchema, type CreateHotelData } from "@booking/shared";
import { prisma } from "../lib/prisma";
import { validate } from "../middleware/validate";

export const hotelsRouter = Router();

hotelsRouter.get("/", async (_req, res) => {
  const hotels = await prisma.hotel.findMany({ orderBy: { createdAt: "desc" } });
  res.json(hotels);
});

hotelsRouter.post("/", validate({ body: createHotelSchema }), async (req, res) => {
  const data = req.body as CreateHotelData; // already parsed by validate()
  const hotel = await prisma.hotel.create({ data });
  res.status(201).json(hotel);
});
