import { Router } from "express";
import { loadSession } from "../../middleware/load-session";
import { requireRole } from "../../middleware/require-role";
import { adminAmenitiesRouter } from "./amenities";
import { adminAuditLogsRouter } from "./audit-logs";
import { adminBookingsRouter } from "./bookings";
import { adminDashboardRouter } from "./dashboard";
import { adminHotelsRouter } from "./hotels";
import { adminStaffRouter } from "./staff";
import { adminUploadsRouter } from "./uploads";

export const adminRouter = Router();

adminRouter.use(loadSession("ADMIN"), requireRole("ADMIN", "STAFF"));
adminRouter.use("/hotels", adminHotelsRouter);
adminRouter.use("/amenities", adminAmenitiesRouter);
adminRouter.use("/audit-logs", adminAuditLogsRouter);
adminRouter.use("/bookings", adminBookingsRouter);
adminRouter.use("/dashboard", adminDashboardRouter);
adminRouter.use("/staff", adminStaffRouter);
adminRouter.use("/uploads", adminUploadsRouter);
