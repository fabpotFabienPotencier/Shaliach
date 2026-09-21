import * as React from 'react';
import { Badge } from './badge';
import {
  ValidationStatus,
  CrmStatus,
  CampaignStatus,
  EmailStatus,
  ReplyClassification,
} from '@shaliach/shared';

interface StatusBadgeProps {
  status:
    | ValidationStatus
    | CrmStatus
    | CampaignStatus
    | EmailStatus
    | ReplyClassification
    | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  let variant:
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
    | 'success'
    | 'warning'
    | 'info'
    | 'purple' = 'secondary';
  let label = status ? String(status).replace(/_/g, ' ') : '-';

  switch (status) {
    // Validation
    case ValidationStatus.VALID:
      variant = 'success';
      break;
    case ValidationStatus.RISKY:
      variant = 'warning';
      break;
    case ValidationStatus.INVALID:
      variant = 'destructive';
      break;
    case ValidationStatus.DUPLICATE:
      variant = 'purple';
      break;
    case ValidationStatus.SUPPRESSED:
      variant = 'destructive';
      break;
    case ValidationStatus.UNKNOWN:
      variant = 'secondary';
      break;

    // CRM
    case CrmStatus.WON:
      variant = 'success';
      break;
    case CrmStatus.LOST:
      variant = 'destructive';
      break;
    case CrmStatus.INTERESTED:
    case CrmStatus.MEETING_REQUESTED:
    case CrmStatus.PROPOSAL_SENT:
      variant = 'info';
      break;
    case CrmStatus.CONTACTED:
    case CrmStatus.REPLIED:
      variant = 'purple';
      break;
    case CrmStatus.SUPPRESSED:
      variant = 'destructive';
      break;

    // Campaign
    case CampaignStatus.RUNNING:
      variant = 'info';
      break;
    case CampaignStatus.COMPLETED:
      variant = 'success';
      break;
    case CampaignStatus.PAUSED:
      variant = 'warning';
      break;
    case CampaignStatus.FAILED:
    case CampaignStatus.CANCELLED:
      variant = 'destructive';
      break;
    case CampaignStatus.READY_FOR_REVIEW:
      variant = 'purple';
      break;

    // Email
    case EmailStatus.DELIVERED:
      variant = 'success';
      break;
    case EmailStatus.SENT:
    case EmailStatus.QUEUED:
      variant = 'info';
      break;
    case EmailStatus.BOUNCED:
    case EmailStatus.COMPLAINED:
    case EmailStatus.FAILED:
      variant = 'destructive';
      break;
    case EmailStatus.REPLIED:
      variant = 'purple';
      break;

    // Reply Classification
    case ReplyClassification.INTERESTED:
    case ReplyClassification.MEETING_REQUEST:
      variant = 'success';
      break;
    case ReplyClassification.PRICING_REQUEST:
    case ReplyClassification.PORTFOLIO_REQUEST:
      variant = 'info';
      break;
    case ReplyClassification.NOT_INTERESTED:
      variant = 'secondary';
      break;
    case ReplyClassification.UNSUBSCRIBE:
    case ReplyClassification.COMPLAINT:
      variant = 'destructive';
      break;
    case ReplyClassification.OUT_OF_OFFICE:
      variant = 'warning';
      break;
  }

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
