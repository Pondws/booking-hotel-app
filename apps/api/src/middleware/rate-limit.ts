import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../env";
import { AppError } from "../lib/app-error";

/** Per-IP limiter; over the limit the error handler responds 429 RATE_LIMITED. */
export function createAuthLimiter(opts: { limit: number; windowMs: number }): RequestHandler {
  return rateLimit({
    limit: opts.limit,
    windowMs: opts.windowMs,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(429, "RATE_LIMITED", "Too many attempts, try again later"));
    },
  });
}

/** Shared by register, login and admin login. */
export const authLimiter: RequestHandler = createAuthLimiter({
  limit: env.AUTH_RATE_LIMIT_MAX,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
});
