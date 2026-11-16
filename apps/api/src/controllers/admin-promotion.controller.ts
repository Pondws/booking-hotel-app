import type { HotelIdParams, PromotionData, PromotionParams } from "@booking/shared";
import type { Request, Response } from "express";
import { noContent, ok } from "../lib/http";
import * as promotionService from "../services/admin-promotion.service";
import { currentUser } from "./booking.controller";

// Bodies are parsed by validate() into req.body; params into res.locals.params.
type Body<T> = Request<Record<string, string>, unknown, T>;

export async function listPromotions(_req: Request, res: Response<unknown, { params: HotelIdParams }>) {
  ok(res, await promotionService.listPromotions(res.locals.params.hotelId));
}

export async function createPromotion(req: Body<PromotionData>, res: Response<unknown, { params: HotelIdParams }>) {
  ok(res, await promotionService.createPromotion(currentUser(req), res.locals.params.hotelId, req.body), 201);
}

export async function updatePromotion(
  req: Body<PromotionData>,
  res: Response<unknown, { params: PromotionParams }>,
) {
  const { hotelId, promotionId } = res.locals.params;
  ok(res, await promotionService.updatePromotion(currentUser(req), hotelId, promotionId, req.body));
}

export async function deletePromotion(req: Request, res: Response<unknown, { params: PromotionParams }>) {
  const { hotelId, promotionId } = res.locals.params;
  await promotionService.deletePromotion(currentUser(req), hotelId, promotionId);
  noContent(res);
}
