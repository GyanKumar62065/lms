import { z } from 'zod';
export const signupDto = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  email: z.string().email(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile'),
  password: z.string().min(8).max(128),
  captchaId: z.string().min(1),
  captchaText: z.string().min(1),
});
export const loginDto = z.object({ email: z.string().email(), password: z.string().min(1) });
export type SignupInput = z.infer<typeof signupDto>;
export type LoginInput = z.infer<typeof loginDto>;
