import type { RatePeriodData, RatePeriodParams, RoomTypeParams } from "@booking/shared";
import type { Request, Response } from "express";
import { noContent, ok } from "../lib/http";
import * as ratePeriodService from "../services/admin-rate-period.service";
import { currentUser } from "./booking.controller";

// Bodies are parsed by validate() into req.body; params into res.locals.params.
type Body<T> = Request<Record<string, string>, unknown, T>;

export async function listRatePeriods(_req: Request, res: Response<unknown, { params: RoomTypeParams }>) {
  const { hotelId, roomTypeId } = res.locals.params;
  ok(res, await ratePeriodService.listRatePeriods(hotelId, roomTypeId));
}

export async function createRatePeriod(
  req: Body<RatePeriodData>,
  res: Response<unknown, { params: RoomTypeParams }>,
) {
  const { hotelId, roomTypeId } = res.locals.params;
  ok(res, await ratePeriodService.createRatePeriod(currentUser(req), hotelId, roomTypeId, req.body), 201);
}

export async function updateRatePeriod(
  req: Body<RatePeriodData>,
  res: Response<unknown, { params: RatePeriodParams }>,
) {
  const { hotelId, roomTypeId, ratePeriodId } = res.locals.params;
  ok(res, await ratePeriodService.updateRatePeriod(currentUser(req), hotelId, roomTypeId, ratePeriodId, req.body));
}

export async function deleteRatePeriod(req: Request, res: Response<unknown, { params: RatePeriodParams }>) {
  const { hotelId, roomTypeId, ratePeriodId } = res.locals.params;
  await ratePeriodService.deleteRatePeriod(currentUser(req), hotelId, roomTypeId, ratePeriodId);
  noContent(res);
}
