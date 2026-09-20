import { z } from 'zod';

export const workerResolutionSchema = z.object({
  issueId: z.string().uuid('Invalid issue ID format'),
  workerId: z.string().uuid('Invalid worker ID format'),
  resolutionImages: z.array(z.string()).min(1, 'At least one resolution photo is required'),
  notes: z.string().optional(),
});

export type WorkerResolutionInput = z.infer<typeof workerResolutionSchema>;
