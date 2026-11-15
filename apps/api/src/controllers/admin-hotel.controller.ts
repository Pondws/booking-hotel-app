import type { AdminHotelListQuery, AmenityListQuery, HotelIdParams } from "@booking/shared";
import type { Request, Response } from "express";
import { AppError } from "../lib/app-error";
import { ok } from "../lib/http";
import * as adminHotelService from "../services/admin-hotel.service";
import * as amenityService from "../services/amenity.service";

// Query and params are parsed by validate() into res.locals.
export async function listAdminHotels(
  req: Request,
  res: Response<unknown, { query: AdminHotelListQuery }>,
) {
  if (!req.auth) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  ok(res, await adminHotelService.listAdminHotels(req.auth.user, res.locals.query));
}

export async function getAdminHotel(
  _req: Request,
  res: Response<unknown, { params: HotelIdParams }>,
) {
  ok(res, await adminHotelService.getAdminHotel(res.locals.params.hotelId));
}

export async function listAmenities(
  _req: Request,
  res: Response<unknown, { query: AmenityListQuery }>,
) {
  ok(res, await amenityService.listAmenities(res.locals.query.scope));
}
