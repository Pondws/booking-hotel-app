import { Router } from "express";
import { listDeals } from "../controllers/deal.controller";

/** `/api/deals` — public list of deals bookable today, for /deals. */
export const dealsRouter = Router();

dealsRouter.get("/", listDeals);
