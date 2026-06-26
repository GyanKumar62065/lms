import { z } from 'zod';
export const recordPaymentDto = z.object({
  utr: z.string().min(3).max(64),
  amount: z.number().positive(), // rupees
  paidAt: z.coerce.date(),
});
