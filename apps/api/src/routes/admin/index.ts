import { Router } from "express";
import { requireRole } from "../../middleware/require-role";
import { adminHotelsRouter } from "./hotels";

export const adminRouter = Router();

adminRouter.use(requireRole("ADMIN", "STAFF"));
adminRouter.use("/hotels", adminHotelsRouter);
