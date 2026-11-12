import type { RequestHandler } from "express";
import type { z } from "zod";

type Schemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

/**
 * Validates request parts with zod. The parsed body replaces req.body;
 * parsed query/params go to res.locals (req.query is read-only in Express 5).
 * Failures throw a ZodError, which the error handler turns into a 400.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, res, next) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) res.locals.query = schemas.query.parse(req.query);
    if (schemas.params) res.locals.params = schemas.params.parse(req.params);
    next();
  };
