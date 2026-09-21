/**
 * Dashboard summary statistics.
 */
export interface DashboardStats {
  leads: {
    total: number;
    valid: number;
    risky: number;
    invalid: number;
    suppressed: number;
  };
  campaigns: {
    active: number;
    draftMessages: number;
    approvedMessages: number;
    queuedMessages: number;
    deliveredMessages: number;
  };
  engagement: {
    replies: number;
    interestedProspects: number;
    proposals: number;
    wonProjects: number;
    revenue: number;
  };
  queues: {
    importHealth: QueueHealth;
    aiHealth: QueueHealth;
    emailHealth: QueueHealth;
  };
  recentActivity: ActivityEntry[];
}

/**
 * Queue health snapshot.
 */
export interface QueueHealth {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  isPaused: boolean;
}

/**
 * Activity feed entry.
 */
export interface ActivityEntry {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  entityId: string | null;
  entityType: string | null;
  createdAt: Date;
}

export type ActivityType =
  | 'IMPORT_COMPLETED'
  | 'IMPORT_FAILED'
  | 'CAMPAIGN_CREATED'
  | 'CAMPAIGN_STARTED'
  | 'CAMPAIGN_COMPLETED'
  | 'EMAIL_DELIVERED'
  | 'EMAIL_BOUNCED'
  | 'EMAIL_COMPLAINED'
  | 'REPLY_RECEIVED'
  | 'LEAD_WON'
  | 'LEAD_LOST'
  | 'REVENUE_RECORDED'
  | 'SUPPRESSION_ADDED';

/**
 * Analytics aggregation for campaigns.
 */
export interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  totalRecipients: number;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  replied: number;
  interested: number;
  deliveryRate: number;
  replyRate: number;
  interestRate: number;
}

/**
 * Analytics breakdown by dimension.
 */
export interface DimensionAnalytics {
  dimension: string;
  value: string;
  leadCount: number;
  contactedCount: number;
  repliedCount: number;
  interestedCount: number;
  wonCount: number;
  revenue: number;
}
