import { Router } from "express";
import { adminAuditLogListQuerySchema } from "@booking/shared";
import { listAuditLogs } from "../../controllers/admin-audit-log.controller";
import { validate } from "../../middleware/validate";

/**
 * `/api/admin/audit-logs` — read only; rows are written by the admin services. Hotel scope is enforced in
 * `audit.service` (staff: own hotels' rows only; another hotel's `hotelId` → 403).
 */
export const adminAuditLogsRouter = Router();

adminAuditLogsRouter.get("/", validate({ query: adminAuditLogListQuerySchema }), listAuditLogs);
