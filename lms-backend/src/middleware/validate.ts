import { RequestHandler } from 'express';
import { ZodTypeAny } from 'zod';
import { ValidationError } from '../lib/errors';

export function validate(schemas: { body?: ZodTypeAny; params?: ZodTypeAny; query?: ZodTypeAny }): RequestHandler {
  return (req, _res, next) => {
    for (const key of ['body', 'params', 'query'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return next(new ValidationError('Validation failed', result.error.flatten()));
      }
      // query/params are read-only getters on some Express versions; assign defensively
      Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true });
    }
    next();
  };
}
