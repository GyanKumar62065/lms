import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from '../../src/lib/jwt';

describe('jwt', () => {
  it('signs and verifies an access token (with session id)', () => {
    const t = signAccessToken({ sub: 'user-1', sid: 'sess-1' });
    expect(verifyAccessToken(t).sub).toBe('user-1');
    expect(verifyAccessToken(t).sid).toBe('sess-1');
  });
  it('hashes a token deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe('abc');
  });
  it('rejects a tampered token', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
  });
  it('signs and verifies a refresh token', () => {
    const t = signRefreshToken({ sub: 'user-2', sid: 'sess-2' });
    expect(verifyRefreshToken(t).sub).toBe('user-2');
    expect(verifyRefreshToken(t).sid).toBe('sess-2');
  });
});
