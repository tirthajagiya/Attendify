/**
 * Operational error used by controllers to signal a known failure
 * (validation, not found, forbidden, etc.) with a proper HTTP status.
 * The global error handler converts these into clean JSON responses.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational = true;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
