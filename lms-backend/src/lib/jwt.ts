import jwt, { SignOptions } from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { config } from '../config';

type TokenPayload = { sub: string; sid: string };

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    // jsonwebtoken types expiresIn as `number | ms.StringValue` (a template-literal union);
    // our TTL comes from env as a plain string, so narrow-cast just this value.
    expiresIn: config.jwt.accessTtl as SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, jti: randomUUID() }, config.jwt.refreshSecret, {
    // jsonwebtoken types expiresIn as `number | ms.StringValue` (a template-literal union);
    // our TTL comes from env as a plain string, so narrow-cast just this value.
    expiresIn: config.jwt.refreshTtl as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
