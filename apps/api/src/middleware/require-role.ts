import type { RequestHandler } from "express";
import type { Role } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";

/**
 * Phase 1 has no sessions, so every request is rejected with 401.
 * Phase 2 replaces the body; the signature stays.
 */
export const requireRole =
  (..._roles: Role[]): RequestHandler =>
  (_req, _res, next) => {
    next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
  };
