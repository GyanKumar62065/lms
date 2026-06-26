import { RequestHandler } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { User } from '../models/user.model';

// like authenticate, but never rejects — used so /track can attach userId when present
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.accessToken;
    if (token) {
      const { sub } = verifyAccessToken(token);
      const user = await User.findById(sub);
      if (user && user.status === 'active') req.auth = { user: user as any, permissions: new Set() };
    }
  } catch {
    /* ignore — anonymous */
  }
  next();
};
