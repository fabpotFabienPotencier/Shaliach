/**
 * Authentication types for the single-user system.
 */
export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  user: AuthenticatedUser | null;
  error?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

/**
 * Audit log entry for security tracking.
 */
export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'IMPORT_CREATED'
  | 'IMPORT_CANCELLED'
  | 'CAMPAIGN_CREATED'
  | 'CAMPAIGN_STARTED'
  | 'CAMPAIGN_PAUSED'
  | 'CAMPAIGN_CANCELLED'
  | 'EMAIL_APPROVED'
  | 'EMAIL_BULK_APPROVED'
  | 'EMAIL_EDITED'
  | 'EMAIL_REGENERATED'
  | 'LEAD_UPDATED'
  | 'LEAD_SUPPRESSED'
  | 'SUPPRESSION_ADDED'
  | 'SUPPRESSION_REMOVED'
  | 'REVENUE_RECORDED'
  | 'CRM_STAGE_CHANGED'
  | 'SETTINGS_UPDATED'
  | 'REPLY_APPROVED';
