import { Captcha } from '../../../src/models/captcha.model';
import { createHash } from 'crypto';

// helper other tests reuse: create a captcha with a known answer
export async function makeKnownCaptcha(answer = 'abcde') {
  // hash the NORMALIZED answer (trim+lowercase) to match verifyCaptcha's norm(), so any-case answers work
  const normalized = answer.trim().toLowerCase();
  const doc = await Captcha.create({ answerHash: createHash('sha256').update(normalized).digest('hex'), expiresAt: new Date(Date.now() + 60000) });
  return { captchaId: doc._id.toString(), captchaText: answer };
}
