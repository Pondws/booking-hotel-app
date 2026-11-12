import type { RequestHandler } from "express";
import type { SessionAudience } from "../generated/prisma/client";
import { COOKIE, readCookie } from "../lib/cookies";
import { resolveSession } from "../services/auth.service";

/**
 * Sets `req.auth` when the audience's cookie holds a live session for that audience.
 * A missing, unknown, expired or wrong-audience session leaves `req.auth` undefined.
 */
export const loadSession =
  (audience: SessionAudience): RequestHandler =>
  async (req, _res, next) => {
    const token = readCookie(req, COOKIE[audience]);
    if (token) {
      const auth = await resolveSession(token, audience);
      if (auth) req.auth = auth;
    }
    next();
  };
