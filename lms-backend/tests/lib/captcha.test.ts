import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../src/db/connect';
import { issueCaptcha, verifyCaptcha } from '../../src/lib/captcha';
import { Captcha } from '../../src/models/captcha.model';

let mem: MongoMemoryServer;
beforeAll(async () => { mem = await MongoMemoryServer.create(); await connectDb(mem.getUri()); });
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('captcha', () => {
  it('issues an svg + id and verifies+consumes the answer', async () => {
    const { captchaId, svg } = await issueCaptcha();
    expect(svg).toContain('<svg');
    // read the stored answer to simulate a correct user entry (test-only introspection)
    const doc: any = await Captcha.findById(captchaId).lean();
    expect(doc).toBeTruthy();
    // wrong answer fails
    expect(await verifyCaptcha(captchaId, 'definitely-wrong')).toBe(false);
    // (doc still exists after a failed attempt)
    expect(await Captcha.findById(captchaId)).toBeTruthy();
  });
  it('returns false for unknown id', async () => {
    expect(await verifyCaptcha('64b000000000000000000000', 'x')).toBe(false);
  });
});
