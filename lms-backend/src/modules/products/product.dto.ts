import { z } from 'zod';

const EMPLOYMENT_MODES = ['Salaried', 'Self-Employed', 'Unemployed'] as const;

const eligibilityShape = z.object({
  minAge: z.number().int().min(18).max(100),
  maxAge: z.number().int().min(18).max(100),
  minMonthlySalary: z.number().int().nonnegative(), // rupees
  employmentModes: z.array(z.enum(EMPLOYMENT_MODES)).min(1),
});

const baseShape = {
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'code must be alphanumeric/underscore').transform((s) => s.toUpperCase()),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  interestRate: z.number().min(0).max(100),
  minPrincipal: z.number().int().positive(), // rupees
  maxPrincipal: z.number().int().positive(),
  minTenureDays: z.number().int().positive(),
  maxTenureDays: z.number().int().positive(),
  eligibility: eligibilityShape,
  category: z.string().min(1).max(60).optional(),
};

function applyRangeRefinements<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine((d: any) => d.minPrincipal == null || d.maxPrincipal == null || d.minPrincipal <= d.maxPrincipal, {
      message: 'minPrincipal must be <= maxPrincipal', path: ['maxPrincipal'],
    })
    .refine((d: any) => d.minTenureDays == null || d.maxTenureDays == null || d.minTenureDays <= d.maxTenureDays, {
      message: 'minTenureDays must be <= maxTenureDays', path: ['maxTenureDays'],
    })
    .refine((d: any) => d.eligibility == null || d.eligibility.minAge <= d.eligibility.maxAge, {
      message: 'minAge must be <= maxAge', path: ['eligibility', 'maxAge'],
    });
}

export const createProductDto = applyRangeRefinements(z.object(baseShape));
export const updateProductDto = applyRangeRefinements(z.object(baseShape).omit({ code: true }).partial());

export type CreateProductInput = z.infer<typeof createProductDto>;
export type UpdateProductInput = z.infer<typeof updateProductDto>;
