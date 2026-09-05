import type { Response } from "express";
import type { ApiError, ApiSuccess } from "@robosphere/shared";

/** Send a success response using the standard envelope. */
export function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { success: true, data };
  res.status(status).json(body);
}

/** Send an error response using the standard envelope. */
export function fail(
  res: Response,
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): void {
  const body: ApiError = { success: false, error: { code, message, details } };
  res.status(status).json(body);
}

/** Thrown by services/controllers and turned into a JSON response by the error handler. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}
