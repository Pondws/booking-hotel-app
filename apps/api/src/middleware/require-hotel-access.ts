import type { RequestHandler } from "express";
import { AppError } from "../lib/app-error";
import { canAccessHotel } from "../services/hotel-access.service";

/** Checks the signed-in user may act on the hotel in `req.params[param]`. */
export const requireHotelAccess =
  (param = "hotelId"): RequestHandler =>
  async (req, _res, next) => {
    if (!req.auth) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
      return;
    }
    const hotelId = req.params[param];
    if (typeof hotelId !== "string" || !(await canAccessHotel(req.auth.user, hotelId))) {
      next(new AppError(403, "FORBIDDEN", "No access to this hotel"));
      return;
    }
    next();
  };
