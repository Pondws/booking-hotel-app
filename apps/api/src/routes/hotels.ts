import { Router } from "express";
import { listHotels } from "../controllers/hotel.controller";

export const hotelsRouter = Router();

hotelsRouter.get("/", listHotels);
