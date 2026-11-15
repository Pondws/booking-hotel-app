import type { AdminAuditLogListQuery } from "@booking/shared";
import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as auditService from "../services/audit.service";
import { currentUser } from "./booking.controller";

export async function listAuditLogs(req: Request, res: Response<unknown, { query: AdminAuditLogListQuery }>) {
  ok(res, await auditService.listAuditLogs(currentUser(req), res.locals.query));
}
