import { z } from 'zod';

export const listLeadsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  stage: z.enum(['REGISTERED', 'DETAILS_SUBMITTED', 'BRE_REJECTED', 'SLIP_UPLOADED', 'APPLIED']).optional(),
});
