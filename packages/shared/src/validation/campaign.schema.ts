import { z } from 'zod';
import { EMAIL_LIMITS } from '../constants/limits';

export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(200),
  description: z.string().max(2000).nullable().optional(),
  mode: z.enum(['MANUAL', 'AI']),
  senderProfileId: z.string().uuid('Invalid sender profile ID'),

  // Manual mode templates
  subjectTemplate: z.string().max(EMAIL_LIMITS.MAX_SUBJECT_LENGTH).nullable().optional(),
  bodyTemplate: z.string().max(EMAIL_LIMITS.MAX_BODY_LENGTH).nullable().optional(),

  // AI mode configuration
  aiPromptNotes: z.string().max(2000).nullable().optional(),

  // Sending configuration
  dailySendLimit: z
    .number()
    .int()
    .min(1)
    .max(EMAIL_LIMITS.MAX_DAILY_LIMIT)
    .default(EMAIL_LIMITS.DEFAULT_DAILY_LIMIT),
  sendingWindowStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format')
    .nullable()
    .optional(),
  sendingWindowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format')
    .nullable()
    .optional(),
  sendingTimezone: z.string().default('America/New_York'),
  scheduledStartDate: z.string().datetime().nullable().optional(),

  // Follow-up
  enableFollowUp: z.boolean().default(false),
  followUpDelayDays: z.number().int().min(1).max(30).default(3),

  // Recipients
  leadIds: z
    .array(z.string().uuid())
    .min(1, 'At least one lead is required'),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  subjectTemplate: z.string().max(EMAIL_LIMITS.MAX_SUBJECT_LENGTH).nullable().optional(),
  bodyTemplate: z.string().max(EMAIL_LIMITS.MAX_BODY_LENGTH).nullable().optional(),
  aiPromptNotes: z.string().max(2000).nullable().optional(),
  dailySendLimit: z
    .number()
    .int()
    .min(1)
    .max(EMAIL_LIMITS.MAX_DAILY_LIMIT)
    .optional(),
  sendingWindowStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  sendingWindowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  sendingTimezone: z.string().optional(),
  enableFollowUp: z.boolean().optional(),
  followUpDelayDays: z.number().int().min(1).max(30).optional(),
});

export const addRecipientsToCampaignSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
});

export const bulkApprovalSchema = z.object({
  recipientIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['APPROVE', 'SKIP', 'REGENERATE']),
});

export const editEmailContentSchema = z.object({
  subject: z.string().min(1).max(EMAIL_LIMITS.MAX_SUBJECT_LENGTH),
  textBody: z.string().min(1).max(EMAIL_LIMITS.MAX_BODY_LENGTH),
  htmlBody: z.string().min(1).max(EMAIL_LIMITS.MAX_BODY_LENGTH),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type AddRecipientsInput = z.infer<typeof addRecipientsToCampaignSchema>;
export type BulkApprovalInput = z.infer<typeof bulkApprovalSchema>;
export type EditEmailContentInput = z.infer<typeof editEmailContentSchema>;
