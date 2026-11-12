import { Router } from "express";
import { loadSession } from "../../middleware/load-session";
import { requireRole } from "../../middleware/require-role";
import { adminHotelsRouter } from "./hotels";

export const adminRouter = Router();

adminRouter.use(loadSession("ADMIN"), requireRole("ADMIN", "STAFF"));
adminRouter.use("/hotels", adminHotelsRouter);
