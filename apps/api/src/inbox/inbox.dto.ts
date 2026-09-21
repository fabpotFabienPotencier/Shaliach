import { z } from 'zod';
import { CrmStatus } from '@shaliach/shared';

export const SendReplySchema = z.object({
  subject: z.string().min(1),
  bodyText: z.string().min(1),
  bodyHtml: z.string().min(1),
  crmStatus: z.nativeEnum(CrmStatus).optional(),
});

export type SendReplyDto = z.infer<typeof SendReplySchema>;
