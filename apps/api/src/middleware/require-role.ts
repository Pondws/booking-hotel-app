import type { RequestHandler } from "express";
import type { Role } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";

/** Requires `req.auth` (set by `loadSession`) and one of the given roles. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
      return;
    }
    if (!roles.includes(req.auth.user.role)) {
      next(new AppError(403, "FORBIDDEN", "Insufficient permissions"));
      return;
    }
    next();
  };
