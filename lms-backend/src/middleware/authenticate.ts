import { RequestHandler } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { AuthError } from '../lib/errors';
import { User } from '../models/user.model';

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.accessToken;
    if (!token) throw new AuthError();
    let sub: string;
    let sid: string;
    try {
      ({ sub, sid } = verifyAccessToken(token));
    } catch {
      throw new AuthError('Invalid or expired token');
    }
    const user = await User.findById(sub).populate({ path: 'role', populate: { path: 'permissions' } });
    if (!user || user.status !== 'active') throw new AuthError('Account inactive');
    // Single-session guard: reject tokens minted for a session that is no longer current
    // (i.e. the user has since logged in elsewhere). Forces the stale session to log out.
    if (!sid || user.sessionId !== sid) throw new AuthError('Session superseded');
    const role: any = user.role;
    const permissions = new Set<string>((role?.permissions ?? []).map((p: any) => p.code));
    req.auth = { user: user as any, permissions };
    next();
  } catch (err) {
    next(err);
  }
};
