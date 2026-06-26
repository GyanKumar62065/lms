import { Request, Response } from 'express';
import ms from 'ms';
import { config } from '../../config';
import * as service from './auth.service';
import { User } from '../../models/user.model';
import { issueCaptcha } from '../../lib/captcha';

function setAuthCookies(res: Response, tokens: { access: string; refresh: string }) {
  const base = { httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite, domain: config.cookie.domain };
  res.cookie('accessToken', tokens.access, { ...base, maxAge: ms(config.jwt.accessTtl as ms.StringValue) });
  res.cookie('refreshToken', tokens.refresh, { ...base, path: '/api/v1/auth', maxAge: ms(config.jwt.refreshTtl as ms.StringValue) });
}
function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken', { httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite, domain: config.cookie.domain });
  res.clearCookie('refreshToken', { httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite, domain: config.cookie.domain, path: '/api/v1/auth' });
}

// The session payload the frontend reads to route by role after auth. Same shape as GET /auth/me.
async function meResponse(userId: unknown) {
  const user = await User.findById(userId as string).populate({ path: 'role', populate: { path: 'permissions' } });
  const role = user!.role as unknown as { code: string; name: string; permissions?: { code: string }[] };
  return {
    id: user!._id,
    fullName: user!.fullName,
    email: user!.email,
    role: { code: role.code, name: role.name },
    permissions: (role.permissions ?? []).map((p) => p.code),
  };
}

export async function signup(req: Request, res: Response) {
  const { user, tokens } = await service.signup(req.body, req.ip);
  setAuthCookies(res, tokens);
  res.status(201).json(await meResponse(user._id));
}
export async function login(req: Request, res: Response) {
  const { user, tokens } = await service.login(req.body, req.ip);
  setAuthCookies(res, tokens);
  res.json(await meResponse(user._id));
}
export async function refresh(req: Request, res: Response) {
  const tokens = await service.rotateRefresh(req.cookies?.refreshToken, req.ip);
  setAuthCookies(res, tokens);
  res.json({ status: 'refreshed' });
}
export async function logout(req: Request, res: Response) {
  await service.logout(req.cookies?.refreshToken);
  clearAuthCookies(res);
  res.status(204).send();
}
export async function getCaptcha(_req: Request, res: Response) {
  res.json(await issueCaptcha());
}
export async function me(req: Request, res: Response) {
  const user = await User.findById(req.auth!.user._id).populate({ path: 'role', populate: { path: 'permissions' } });
  // populated role doc; Mongoose's populate typing returns ObjectId | doc, so narrow to the fields we read
  const role = user!.role as unknown as { code: string; name: string };
  res.json({
    id: user!._id,
    fullName: user!.fullName,
    email: user!.email,
    role: { code: role.code, name: role.name },
    permissions: [...req.auth!.permissions],
  });
}
