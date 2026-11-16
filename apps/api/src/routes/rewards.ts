import { Router } from "express";
import { getMine } from "../controllers/rewards.controller";
import { loadSession } from "../middleware/load-session";
import { requireAuth } from "../middleware/require-auth";

/** `/api/rewards` — the signed-in customer's points and tier (web session). */
export const rewardsRouter = Router();

rewardsRouter.use(loadSession("WEB"), requireAuth);

rewardsRouter.get("/me", getMine);
