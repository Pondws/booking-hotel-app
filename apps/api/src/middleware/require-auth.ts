import type { RequestHandler } from "express";
import { AppError } from "../lib/app-error";

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    return;
  }
  next();
};
