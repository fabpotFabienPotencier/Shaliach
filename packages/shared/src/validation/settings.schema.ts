import { z } from 'zod';

export const updateSenderProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  fromName: z.string().min(1).max(200).optional(),
  fromEmail: z.string().email().max(255).optional(),
  replyToEmail: z.string().email().max(255).optional(),
  companyName: z.string().min(1).max(200).optional(),
  companyWebsite: z.string().max(255).optional(),
  postalAddress: z.string().max(500).optional(),
  signature: z.string().max(2000).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const updateSettingsSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(5000),
});

export const updateBulkSettingsSchema = z.array(
  z.object({
    key: z.string().min(1).max(100),
    value: z.string().max(5000),
  })
);

export type UpdateSenderProfileInput = z.infer<typeof updateSenderProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type UpdateBulkSettingsInput = z.infer<typeof updateBulkSettingsSchema>;
