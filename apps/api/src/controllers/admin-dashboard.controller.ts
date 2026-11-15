import type { AdminDashboardQuery } from "@booking/shared";
import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as adminDashboardService from "../services/admin-dashboard.service";
import { currentUser } from "./booking.controller";

export async function getDashboard(req: Request, res: Response<unknown, { query: AdminDashboardQuery }>) {
  ok(res, await adminDashboardService.getAdminDashboard(currentUser(req), res.locals.query));
}
