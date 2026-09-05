import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

/** Validate (and replace) req.body. Throws ZodError → 400 via error handler. */
export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}

/** Validate req.query — throws ZodError → 400 on invalid input. */
export function validateQuery<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    schema.parse(req.query);
    next();
  };
}

/** Validate req.params — throws ZodError → 400 on invalid input. */
export function validateParams<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    schema.parse(req.params);
    next();
  };
}
