import { Router } from "express";
import { adminDashboardQuerySchema } from "@booking/shared";
import { getDashboard } from "../../controllers/admin-dashboard.controller";
import { validate } from "../../middleware/validate";

/**
 * `/api/admin/dashboard` — across hotels, so hotel scope is enforced in `admin-dashboard.service`
 * (staff: own hotels only; another hotel's `hotelId` → 403).
 */
export const adminDashboardRouter = Router();

adminDashboardRouter.get("/", validate({ query: adminDashboardQuerySchema }), getDashboard);
