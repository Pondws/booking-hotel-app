import { Router } from "express";
import { loadSession } from "../../middleware/load-session";
import { requireRole } from "../../middleware/require-role";
import { adminAmenitiesRouter } from "./amenities";
import { adminHotelsRouter } from "./hotels";
import { adminUploadsRouter } from "./uploads";

export const adminRouter = Router();

adminRouter.use(loadSession("ADMIN"), requireRole("ADMIN", "STAFF"));
adminRouter.use("/hotels", adminHotelsRouter);
adminRouter.use("/amenities", adminAmenitiesRouter);
adminRouter.use("/uploads", adminUploadsRouter);
