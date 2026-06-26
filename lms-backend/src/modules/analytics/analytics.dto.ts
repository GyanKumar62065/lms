import { z } from 'zod';
export const trackDto = z.object({
  events: z.array(z.object({
    name: z.string().min(1).max(64),
    path: z.string().max(512).optional(),
    referrer: z.string().max(512).optional(),
    utm: z.object({ source: z.string().optional(), medium: z.string().optional(), campaign: z.string().optional() }).optional(),
    ts: z.coerce.date().optional(),
  })).min(1).max(50),
});
