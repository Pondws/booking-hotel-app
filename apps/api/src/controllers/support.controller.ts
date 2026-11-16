import type {
  AdminSupportListQuery,
  BookingCodeParams,
  CreateSupportRequestData,
  ResolveSupportRequestData,
  SupportRequestIdParams,
} from "@booking/shared";
import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as supportService from "../services/support.service";
import { currentUser } from "./booking.controller";

// Bodies are parsed by validate() into req.body; params and query into res.locals.
type Body<T> = Request<Record<string, string>, unknown, T>;

export async function listMine(req: Request, res: Response<unknown, { params: BookingCodeParams }>) {
  ok(res, await supportService.listMySupportRequests(currentUser(req), res.locals.params.code));
}

export async function create(
  req: Body<CreateSupportRequestData>,
  res: Response<unknown, { params: BookingCodeParams }>,
) {
  ok(res, await supportService.createSupportRequest(currentUser(req), res.locals.params.code, req.body), 201);
}

export async function listAdmin(req: Request, res: Response<unknown, { query: AdminSupportListQuery }>) {
  ok(res, await supportService.listAdminSupportRequests(currentUser(req), res.locals.query));
}

export async function resolve(
  req: Body<ResolveSupportRequestData>,
  res: Response<unknown, { params: SupportRequestIdParams }>,
) {
  ok(res, await supportService.resolveSupportRequest(currentUser(req), res.locals.params.requestId, req.body));
}
