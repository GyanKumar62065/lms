import { RequestHandler } from 'express';
import { AuthError, ForbiddenError } from '../lib/errors';

export function authorize(...required: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AuthError());
    for (const code of required) {
      if (!req.auth.permissions.has(code)) {
        return next(new ForbiddenError(`Missing permission: ${code}`));
      }
    }
    next();
  };
}
