import { z } from 'zod';
export const profileDto = z.object({
  fullName: z.string().min(1),
  pan: z.string().transform((s) => s.toUpperCase()),
  dob: z.coerce.date(),
  monthlySalary: z.number().positive(), // rupees from client
  employmentMode: z.enum(['Salaried', 'Self-Employed', 'Unemployed']),
});
export type ProfileInput = z.infer<typeof profileDto>;

export const presignDto = z.object({
  filename: z.string().min(1),
  mime: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  size: z.number().int().positive().max(5 * 1024 * 1024),
});
export const confirmSlipDto = z.object({
  objectKey: z.string().min(1),
  filename: z.string().min(1),
  mime: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  size: z.number().int().positive().max(5 * 1024 * 1024),
});
export const applyDto = z.object({
  productCode: z.string().trim().min(1).transform((s) => s.toUpperCase()),
  principal: z.number().int().min(1000).max(1_000_000), // rupees — outer guard; real bounds per product
  tenureDays: z.number().int().min(1).max(365),
});
export type ApplyInput = z.infer<typeof applyDto>;
