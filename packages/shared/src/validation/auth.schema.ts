import { z } from 'zod';
import { AUTH_LIMITS } from '../constants/limits';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .max(255),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(AUTH_LIMITS.MIN_PASSWORD_LENGTH, `Password must be at least ${AUTH_LIMITS.MIN_PASSWORD_LENGTH} characters`)
    .max(128),
  confirmPassword: z
    .string()
    .min(1, 'Confirm password is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
