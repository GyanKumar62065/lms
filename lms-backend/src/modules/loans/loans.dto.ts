import { z } from 'zod';
export const rejectDto = z.object({ reason: z.string().min(3).max(500) });
export const cancelDto = z.object({ reason: z.string().min(3).max(500).optional() });

export const listLoansQuery = z.object({
  status: z.enum(['APPLIED', 'SANCTIONED', 'REJECTED', 'DISBURSED', 'CLOSED']).optional(),
  productCode: z.string().min(1).max(64).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().min(1).max(120).optional(),
  minAmount: z.coerce.number().nonnegative().optional(), // rupees
  maxAmount: z.coerce.number().nonnegative().optional(), // rupees
  sort: z
    .enum(['-createdAt', 'createdAt', 'principal', '-principal', 'outstanding', '-outstanding'])
    .default('-createdAt'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
