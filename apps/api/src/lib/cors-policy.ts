import cors from "cors";
import type { RequestHandler } from "express";

export type CorsOrigins = { web: readonly string[]; admin: readonly string[] };

/** True when `path` is `prefix` itself or a sub-path of it (segment-aware). */
function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Browser origins allowed to make credentialed requests to `path`.
 * - admin API + admin auth → web-admin only, so script on the customer site can never
 *   read admin responses with a staff member's `admin_sid`
 * - customer auth → web only
 * - everything else (public catalog, health) → both apps
 */
export function allowedOriginsFor(path: string, origins: CorsOrigins): string[] {
  if (isUnder(path, "/api/admin") || isUnder(path, "/api/auth/admin")) return [...origins.admin];
  if (isUnder(path, "/api/auth")) return [...origins.web];
  return [...origins.web, ...origins.admin];
}

/** CORS middleware that picks the allowed origins per request path. */
export function corsPolicy(origins: CorsOrigins): RequestHandler {
  return cors((req, callback) => {
    callback(null, { origin: allowedOriginsFor(req.path, origins), credentials: true });
  });
}
