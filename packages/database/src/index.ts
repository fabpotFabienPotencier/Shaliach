// ═══════════════════════════════════════════════════════════════
// @shaliach/database — Prisma Client Barrel Export
// ═══════════════════════════════════════════════════════════════

export { PrismaClient } from '@prisma/client';
export type { Prisma } from '@prisma/client';

// Re-export all generated model types
export type {
  User,
  SenderProfile,
  LeadList,
  Lead,
  ImportJob,
  ImportRow,
  Campaign,
  CampaignRecipient,
  AiGeneration,
  EmailMessage,
  EmailEvent,
  Conversation,
  InboundMessage,
  SuppressionEntry,
  WebhookEvent,
  AuditLog,
  RevenueEntry,
  Setting,
} from '@prisma/client';
