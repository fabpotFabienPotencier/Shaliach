import { z } from 'zod';
import { CampaignMode } from '@shaliach/shared';

export const CreateCampaignSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  mode: z.nativeEnum(CampaignMode),
  senderProfileId: z.string().optional(),
  dailySendLimit: z.number().int().min(1).max(2000).default(50),
  promptGuidelines: z.string().optional(),
  templateSubject: z.string().optional(),
  templateBodyText: z.string().optional(),
  templateBodyHtml: z.string().optional(),
  leadIds: z.array(z.string()).optional(),
  leadListIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
});

export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;

export const UpdateCampaignSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  dailySendLimit: z.number().int().min(1).max(2000).optional(),
  promptGuidelines: z.string().optional(),
  templateSubject: z.string().optional(),
  templateBodyText: z.string().optional(),
  templateBodyHtml: z.string().optional(),
  senderProfileId: z.string().optional(),
});

export type UpdateCampaignDto = z.infer<typeof UpdateCampaignSchema>;

export const CampaignStatusActionSchema = z.object({
  action: z.enum(['START', 'PAUSE', 'RESUME', 'CANCEL', 'GENERATE_AI']),
});

export type CampaignStatusActionDto = z.infer<typeof CampaignStatusActionSchema>;
