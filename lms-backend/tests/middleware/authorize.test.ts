import { authorize } from '../../src/middleware/authorize';
import { AuthError, ForbiddenError } from '../../src/lib/errors';

function run(mw: any, req: any) {
  return new Promise((resolve, reject) => mw(req, {}, (e?: unknown) => (e ? reject(e) : resolve(true))));
}

describe('authorize', () => {
  it('allows when permission present', async () => {
    const req: any = { auth: { permissions: new Set(['loan:sanction']) } };
    await expect(run(authorize('loan:sanction'), req)).resolves.toBe(true);
  });
  it('forbids when permission missing', async () => {
    const req: any = { auth: { permissions: new Set(['lead:read']) } };
    await expect(run(authorize('loan:sanction'), req)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it('401s when unauthenticated', async () => {
    await expect(run(authorize('x'), {})).rejects.toBeInstanceOf(AuthError);
  });
});
