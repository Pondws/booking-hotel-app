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

const accountKey = (body: unknown): string | undefined => {
  if (typeof body !== "object" || body === null || !("email" in body)) return undefined;
  return typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
};

/**
 * Per-account limiter for login: counts only failed attempts (status >= 400) per normalized email,
 * so spreading a password guess over many IPs doesn't help. A request without an email string is skipped
 * (validation rejects it; the per-IP limiter still counts it). Memory store — resets on restart.
 */
export function createAccountLimiter(opts: { limit: number; windowMs: number }): RequestHandler {
  return rateLimit({
    limit: opts.limit,
    windowMs: opts.windowMs,
    standardHeaders: false,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: (req) => accountKey(req.body) === undefined,
    keyGenerator: (req) => `account:${accountKey(req.body) ?? ""}`,
    handler: (_req, _res, next) => {
      next(new AppError(429, "RATE_LIMITED", "Too many attempts, try again later"));
    },
  });
}

/** Shared by login and admin login (one counter per account across both). */
export const accountLimiter: RequestHandler = createAccountLimiter({
  limit: env.AUTH_RATE_LIMIT_MAX,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
});
