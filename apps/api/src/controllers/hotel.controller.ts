import type { AvailabilityQuery, CreateHotelData, HotelReviewsQuery, HotelSearchQuery } from "@booking/shared";
import type { Request, Response } from "express";
import { ok } from "../lib/http";
import * as hotelService from "../services/hotel.service";
import * as reviewService from "../services/review.service";
import { currentUser } from "./booking.controller";

// Query and params are parsed by validate() into res.locals.
type SlugParams = { slug: string };

export async function searchHotels(
  _req: Request,
  res: Response<unknown, { query: HotelSearchQuery }>,
) {
  ok(res, await hotelService.searchHotels(res.locals.query));
}

export async function getHotel(_req: Request, res: Response<unknown, { params: SlugParams }>) {
  ok(res, await hotelService.getHotelBySlug(res.locals.params.slug));
}

export async function getAvailability(
  _req: Request,
  res: Response<unknown, { params: SlugParams; query: AvailabilityQuery }>,
) {
  ok(res, await hotelService.getAvailability(res.locals.params.slug, res.locals.query));
}

export async function getHotelReviews(
  _req: Request,
  res: Response<unknown, { params: SlugParams; query: HotelReviewsQuery }>,
) {
  ok(res, await reviewService.listHotelReviews(res.locals.params.slug, res.locals.query));
}

// Body is already parsed by validate().
export async function createHotel(
  req: Request<Record<string, string>, unknown, CreateHotelData>,
  res: Response,
) {
  ok(res, await hotelService.createHotel(currentUser(req), req.body), 201);
}
