import { z } from 'zod';
import { validate } from '../../src/middleware/validate';
import { ValidationError } from '../../src/lib/errors';

function run(mw: any, req: any) {
  return new Promise((resolve, reject) => {
    mw(req, {}, (err?: unknown) => (err ? reject(err) : resolve(req)));
  });
}

describe('validate', () => {
  it('passes and coerces valid body', async () => {
    const mw = validate({ body: z.object({ n: z.coerce.number() }) });
    const req: any = { body: { n: '5' } };
    await run(mw, req);
    expect(req.body.n).toBe(5);
  });
  it('throws ValidationError on invalid body', async () => {
    const mw = validate({ body: z.object({ n: z.number() }) });
    await expect(run(mw, { body: { n: 'x' } })).rejects.toBeInstanceOf(ValidationError);
  });
});
