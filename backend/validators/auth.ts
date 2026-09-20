import { z } from 'zod';
import { LoginAccessType } from '../services/auth/types';

export const loginAccessTypeSchema = z.enum(['citizen', 'authority', 'worker']);

export const emailSchema = z.string().trim().email('Please enter a valid email address');
export const passwordSchema = z.string().min(1, 'Password is required');

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  accessType: loginAccessTypeSchema,
});

export const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
});

export const officialAccessCodeSchema = z.string().min(4, 'Access code is required');

export type LoginInputSchema = z.infer<typeof loginSchema>;
export type SignupInputSchema = z.infer<typeof signupSchema>;
