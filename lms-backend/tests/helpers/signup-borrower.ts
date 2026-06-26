import { makeKnownCaptcha } from '../modules/auth/captcha.helper';

let n = 0;
// signs up a borrower with the v2 body (names + unique phone + a valid captcha)
export async function signupBorrower(agent: any, over: Record<string, unknown> = {}) {
  n += 1;
  const cap = await makeKnownCaptcha();
  const phone = '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0').slice(0, 9);
  return agent.post('/api/v1/auth/signup').send({
    firstName: 'Test', lastName: `User${n}`,
    email: `b${Date.now()}-${n}-${Math.random().toString(36).slice(2)}@x.com`,
    phone, password: 'Passw0rd!', ...cap, ...over,
  });
}
