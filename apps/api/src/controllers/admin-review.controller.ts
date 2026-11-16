import type { AdminReviewListQuery, ReviewIdParams, UpdateReviewVisibilityInput } from "@booking/shared";
import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as adminReviewService from "../services/admin-review.service";
import { currentUser } from "./booking.controller";

// Bodies are parsed by validate() into req.body; query and params into res.locals.
type Body<T> = Request<Record<string, string>, unknown, T>;

export async function listReviews(req: Request, res: Response<unknown, { query: AdminReviewListQuery }>) {
  ok(res, await adminReviewService.listAdminReviews(currentUser(req), res.locals.query));
}

export async function updateReview(
  req: Body<UpdateReviewVisibilityInput>,
  res: Response<unknown, { params: ReviewIdParams }>,
) {
  ok(res, await adminReviewService.setReviewVisibility(currentUser(req), res.locals.params.reviewId, req.body));
}
