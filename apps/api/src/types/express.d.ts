import type { PublicUser } from "@booking/shared";

declare global {
  namespace Express {
    interface Request {
      /** Set by `loadSession(audience)` when the request carries a valid session cookie. */
      auth?: { user: PublicUser; sessionId: string };
    }
  }
}

export {};
