import type { LoginInput, RegisterInput } from "@booking/shared";
import type { Request, RequestHandler, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { SessionAudience } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";
import { clearSessionCookie, SESSION_TTL_MS, setSessionCookie } from "../lib/cookies";
import { noContent, ok } from "../lib/http";
import * as authService from "../services/auth.service";

function sessionMeta(req: Request): authService.SessionMeta {
  const meta: authService.SessionMeta = {};
  if (req.ip) meta.ip = req.ip;
  const userAgent = req.get("user-agent");
  if (userAgent) meta.userAgent = userAgent;
  return meta;
}

// Bodies below are already parsed by validate().
export async function register(
  req: Request<ParamsDictionary, unknown, RegisterInput>,
  res: Response,
) {
  const { user, token } = await authService.register(req.body, sessionMeta(req));
  setSessionCookie(res, "WEB", token, SESSION_TTL_MS.WEB);
  ok(res, user, 201);
}

export const login =
  (audience: SessionAudience): RequestHandler<ParamsDictionary, unknown, LoginInput> =>
  async (req, res) => {
    const { user, token } = await authService.login(req.body, audience, sessionMeta(req));
    setSessionCookie(res, audience, token, SESSION_TTL_MS[audience]);
    ok(res, user);
  };

export const logout =
  (audience: SessionAudience): RequestHandler =>
  async (req, res) => {
    if (req.auth) await authService.logout(req.auth.sessionId);
    clearSessionCookie(res, audience);
    noContent(res);
  };

export function me(req: Request, res: Response) {
  if (!req.auth) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  ok(res, req.auth.user);
}
