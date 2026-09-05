import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, fail } from "../lib/response";
import { logger } from "../lib/logger";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return fail(res, "VALIDATION_ERROR", "Invalid input", 400, err.flatten());
  }

  if (err instanceof AppError) {
    return fail(res, err.code, err.message, err.status, err.details);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return fail(res, "CONFLICT", "Duplicate entry detected", 409);
    }
    if (err.code === "P2025") {
      return fail(res, "NOT_FOUND", "Record not found", 404);
    }
  }

  logger.error("Unhandled error", err instanceof Error ? err.stack : err);
  return fail(res, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error", 500);
};
