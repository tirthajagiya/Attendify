import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// Express recognises this as the error handler from the 4 arguments.
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const status = isAppError ? err.statusCode : 500;

  if (!isAppError && env.nodeEnv !== 'test') {
    console.error('[error]', err);
  }

  res.status(status).json({
    success: false,
    message: isAppError ? err.message : 'Internal server error',
    ...(env.nodeEnv === 'development' && !isAppError ? { stack: err.stack } : {}),
  });
}
