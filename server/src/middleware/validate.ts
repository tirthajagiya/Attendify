import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';

/**
 * Returns middleware that validates `req.body` against the given Zod schema.
 * On success it replaces req.body with the parsed (and typed) data so handlers
 * can rely on the shape without re-checking.
 */
export const validateBody =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      return next(new AppError(message, 400));
    }
    req.body = result.data;
    next();
  };
