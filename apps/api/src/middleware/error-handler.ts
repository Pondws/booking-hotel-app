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
