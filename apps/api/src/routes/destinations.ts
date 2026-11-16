import { Router } from "express";
import { listDestinations } from "../controllers/destination.controller";

/** `/api/destinations` — public city summary (count, starting price, cover) for /destinations and the home page. */
export const destinationsRouter = Router();

destinationsRouter.get("/", listDestinations);
