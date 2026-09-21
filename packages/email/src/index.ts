export type { EmailProvider } from './interfaces/email-provider.interface';
export { ResendEmailProvider } from './providers/resend-email.provider';
export type { ResendEmailProviderOptions } from './providers/resend-email.provider';

export {
  renderFixHubTechHtmlEmail,
  renderFixHubTechTextEmail,
  type FixHubTechEmailTemplateParams,
} from './templates/fixhubtech-outreach.template';

export {
  renderFixHubTechReplyHtml,
  renderFixHubTechReplyText,
} from './templates/fixhubtech-reply.template';

export {
  renderFixHubTechFollowUpHtml,
  renderFixHubTechFollowUpText,
} from './templates/fixhubtech-followup.template';

export {
  generateUnsubscribeToken,
  verifyAndParseUnsubscribeToken,
  buildUnsubscribeUrl,
  type UnsubscribeTokenPayload,
} from './utils/unsubscribe.util';

export {
  sanitizeTextBody,
  sanitizeHtmlBody,
  sanitizeCsvField,
} from './utils/sanitize-email.util';
