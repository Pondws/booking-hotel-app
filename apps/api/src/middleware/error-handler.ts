import type { ErrorRequestHandler, Response } from "express";
import { z, ZodError } from "zod";
import type { ErrorCode } from "@booking/shared";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "../lib/app-error";

function send(res: Response, status: number, code: ErrorCode, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, ...(details === undefined ? {} : { details }) } });
}

function isMalformedJson(err: unknown): boolean {
  return err instanceof SyntaxError && "type" in err && err.type === "entity.parse.failed";
}

const BODY_PARSER_ERROR_TYPES: ReadonlySet<string> = new Set([
  "entity.too.large",
  "encoding.unsupported",
  "charset.unsupported",
  "entity.verify.failed",
]);

/** The 4xx status of a body-parser error (e.g. 413, 415), or null for anything else. */
function bodyParserErrorStatus(err: unknown): number | null {
  if (!(err instanceof Error)) return null;
  if (!("type" in err) || typeof err.type !== "string") return null;
  if (!BODY_PARSER_ERROR_TYPES.has(err.type)) return null;
  if (!("status" in err) || typeof err.status !== "number") return null;
  return err.status >= 400 && err.status <= 499 ? err.status : null;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    send(res, err.status, err.code, err.message, err.details);
    return;
  }
  if (err instanceof ZodError) {
    send(res, 400, "VALIDATION_FAILED", "Validation failed", z.flattenError(err));
    return;
  }
  if (isMalformedJson(err)) {
    send(res, 400, "VALIDATION_FAILED", "Malformed JSON body");
    return;
  }
  const bodyStatus = bodyParserErrorStatus(err);
  if (bodyStatus !== null) {
    send(res, bodyStatus, "VALIDATION_FAILED", "Invalid request body");
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      send(res, 409, "CONFLICT", "Resource already exists");
      return;
    }
    if (err.code === "P2025") {
      send(res, 404, "NOT_FOUND", "Resource not found");
      return;
    }
  }
  console.error(err);
  send(res, 500, "INTERNAL", "Internal server error");
};
