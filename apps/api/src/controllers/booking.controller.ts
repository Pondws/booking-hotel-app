import type { BookingListQuery, CreateBookingData, CreateReviewData, PublicUser } from "@booking/shared";
import type { Request, Response } from "express";
import { AppError } from "../lib/app-error";
import { ok } from "../lib/http";
import * as bookingService from "../services/booking.service";
import * as reviewService from "../services/review.service";

type CodeParams = { code: string };

/** The signed-in customer; `requireAuth` guarantees it, this narrows without `!`. */
export function currentUser(req: Request): PublicUser {
  if (!req.auth) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  return req.auth.user;
}

// Body, query and params are already parsed by validate().
export async function create(
  req: Request<Record<string, string>, unknown, CreateBookingData>,
  res: Response,
) {
  ok(res, await bookingService.createBooking(currentUser(req), req.body), 201);
}

export async function listMine(req: Request, res: Response<unknown, { query: BookingListQuery }>) {
  ok(res, await bookingService.listMyBookings(currentUser(req), res.locals.query));
}

export async function getOne(req: Request, res: Response<unknown, { params: CodeParams }>) {
  ok(res, await bookingService.getMyBooking(currentUser(req), res.locals.params.code));
}

export async function review(
  req: Request<Record<string, string>, unknown, CreateReviewData>,
  res: Response<unknown, { params: CodeParams }>,
) {
  ok(res, await reviewService.createMyReview(currentUser(req), res.locals.params.code, req.body), 201);
}

export async function cancel(req: Request, res: Response<unknown, { params: CodeParams }>) {
  ok(res, await bookingService.cancelMyBooking(currentUser(req), res.locals.params.code));
}
