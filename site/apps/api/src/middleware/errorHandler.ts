import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, fail } from "../lib/response";
import { logger } from "../lib/logger";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return fail(res, "VALIDATION_ERROR", "Invalid input", 400, err.flatten());
  }

  if (err instanceof AppError) {
    return fail(res, err.code, err.message, err.status, err.details);
  }

  logger.error("Unhandled error", err instanceof Error ? err.stack : err);
  return fail(res, "INTERNAL_ERROR", "Internal server error", 500);
};
