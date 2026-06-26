import svgCaptcha from 'svg-captcha';
import { createHash } from 'crypto';
import { Captcha } from '../models/captcha.model';

const TTL_MS = (Number(process.env.CAPTCHA_TTL_SECONDS) || 300) * 1000;
const norm = (s: string) => s.trim().toLowerCase();
const hash = (s: string) => createHash('sha256').update(norm(s)).digest('hex');

export async function issueCaptcha(): Promise<{ captchaId: string; svg: string }> {
  const c = svgCaptcha.create({ size: 5, noise: 2, ignoreChars: '0o1il', color: true });
  const doc = await Captcha.create({ answerHash: hash(c.text), expiresAt: new Date(Date.now() + TTL_MS) });
  return { captchaId: doc._id.toString(), svg: c.data };
}

export async function verifyCaptcha(captchaId: string, text: string): Promise<boolean> {
  if (!captchaId || !text) return false;
  const doc = await Captcha.findById(captchaId).catch(() => null);
  if (!doc) return false;
  if (doc.expiresAt.getTime() < Date.now()) return false;
  const ok = doc.answerHash === hash(text);
  if (ok) await Captcha.deleteOne({ _id: doc._id }); // one-time use: consume only on success
  return ok;
}
