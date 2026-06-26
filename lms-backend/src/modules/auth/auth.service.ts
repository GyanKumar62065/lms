import ms from 'ms';
import { randomUUID } from 'crypto';
import { User } from '../../models/user.model';
import { Role } from '../../models/role.model';
import { RefreshToken } from '../../models/refresh-token.model';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from '../../lib/jwt';
import { AuthError, ConflictError, CaptchaError } from '../../lib/errors';
import { verifyCaptcha } from '../../lib/captcha';
import { config } from '../../config';
import { SignupInput, LoginInput } from './auth.dto';

// Mint an access+refresh pair carrying the given session id and persist the refresh token.
async function issueTokensForSession(userId: string, sid: string, ip?: string) {
  const access = signAccessToken({ sub: userId, sid });
  const refresh = signRefreshToken({ sub: userId, sid });
  await RefreshToken.create({
    user: userId,
    sid,
    tokenHash: hashToken(refresh),
    expiresAt: new Date(Date.now() + ms(config.jwt.refreshTtl as ms.StringValue)),
    createdByIp: ip,
  });
  return { access, refresh };
}

// Start a NEW session (login / signup): set a fresh sessionId on the user and revoke every
// other live refresh token — enforcing a single active session per user. Any access token
// from a prior session is rejected immediately by the authenticate middleware (sid mismatch).
async function startSession(userId: string, ip?: string) {
  const sid = randomUUID();
  await User.updateOne({ _id: userId }, { $set: { sessionId: sid } });
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  return issueTokensForSession(userId, sid, ip);
}

export async function signup(input: SignupInput, ip?: string) {
  if (!(await verifyCaptcha(input.captchaId, input.captchaText))) {
    throw new CaptchaError();
  }
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new ConflictError('Email already registered');
  if (await User.findOne({ phone: input.phone })) throw new ConflictError('Phone already registered');
  const borrowerRole = await Role.findOne({ code: 'BORROWER' });
  if (!borrowerRole) throw new Error('BORROWER role missing — run seed');
  // eslint-disable-next-line prefer-const
  let user: InstanceType<typeof User>;
  try {
    user = await User.create({
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: `${input.firstName} ${input.lastName}`,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      role: borrowerRole._id,
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      throw new ConflictError(field === 'phone' ? 'Phone already registered' : 'Email already registered');
    }
    throw err;
  }
  return { user, tokens: await startSession(user._id.toString(), ip) };
}

export async function login(input: LoginInput, ip?: string) {
  const user = await User.findOne({ email: input.email.toLowerCase() });
  if (!user || user.status !== 'active') throw new AuthError('Invalid credentials');
  if (!(await verifyPassword(input.password, user.passwordHash))) throw new AuthError('Invalid credentials');
  return { user, tokens: await startSession(user._id.toString(), ip) };
}

export async function rotateRefresh(token: string, ip?: string) {
  let sub: string;
  let sid: string;
  try {
    ({ sub, sid } = verifyRefreshToken(token));
  } catch {
    throw new AuthError('Invalid refresh token');
  }
  const hash = hashToken(token);
  const stored = await RefreshToken.findOne({ tokenHash: hash });
  if (!stored || stored.revokedAt) throw new AuthError('Refresh token revoked');
  if (stored.expiresAt < new Date()) throw new AuthError('Refresh token expired');
  // Single-session guard: the refresh must belong to the user's current session.
  const user = await User.findById(sub);
  if (!user || user.status !== 'active' || user.sessionId !== sid) throw new AuthError('Session superseded');
  stored.revokedAt = new Date();
  await stored.save();
  // Rotate within the SAME session (keep sid; do not revoke siblings or change user.sessionId).
  return issueTokensForSession(sub, sid, ip);
}

export async function logout(token?: string) {
  if (!token) return;
  await RefreshToken.updateOne({ tokenHash: hashToken(token) }, { $set: { revokedAt: new Date() } });
}
