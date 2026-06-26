import { hashPassword, verifyPassword } from '../../src/lib/password';

describe('password', () => {
  it('hashes and verifies a password', async () => {
    const h = await hashPassword('s3cret!');
    expect(h).not.toContain('s3cret!');
    expect(await verifyPassword('s3cret!', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });
});
