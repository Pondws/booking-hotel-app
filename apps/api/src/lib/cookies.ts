import type { CookieOptions, Request, Response } from "express";
import type { SessionAudience } from "../generated/prisma/enums";
import { env } from "../env";

export const COOKIE = { WEB: "sid", ADMIN: "admin_sid" } as const satisfies Record<
  SessionAudience,
  string
>;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const SESSION_TTL_MS: Record<SessionAudience, number> = {
  WEB: 30 * DAY_MS,
  ADMIN: 12 * HOUR_MS,
};

export function readCookie(req: Pick<Request, "headers">, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: env.NODE_ENV === "production",
});

export function setSessionCookie(
  res: Response,
  audience: SessionAudience,
  token: string,
  maxAgeMs: number,
): void {
  res.cookie(COOKIE[audience], token, { ...baseOptions(), maxAge: maxAgeMs });
}

export function clearSessionCookie(res: Response, audience: SessionAudience): void {
  res.clearCookie(COOKIE[audience], baseOptions());
}
