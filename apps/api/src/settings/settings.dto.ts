import { z } from 'zod';

export const SenderProfileSchema = z.object({
  name: z.string().min(2),
  fromEmail: z.string().email(),
  fromName: z.string().min(2),
  replyToEmail: z.string().email(),
  dailyLimit: z.number().int().min(1).max(2000).default(100),
  isDefault: z.boolean().default(false),
});

export type SenderProfileDto = z.infer<typeof SenderProfileSchema>;

export const UpdateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
});

export type UpdateSettingDto = z.infer<typeof UpdateSettingSchema>;
