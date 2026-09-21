/**
 * Regex patterns for validation.
 */

/**
 * RFC 5322 simplified email regex.
 * Validates basic email structure without being overly permissive.
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Domain extraction from email.
 */
export const DOMAIN_REGEX = /@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;

/**
 * URL validation (loose).
 */
export const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/**
 * Role-based email prefixes that should be flagged as RISKY.
 */
export const ROLE_EMAIL_PREFIXES: readonly string[] = [
  'admin',
  'administrator',
  'abuse',
  'billing',
  'compliance',
  'contact',
  'devnull',
  'dns',
  'ftp',
  'help',
  'hostmaster',
  'info',
  'inoc',
  'ispfeedback',
  'ispsupport',
  'list',
  'maildaemon',
  'marketing',
  'media',
  'news',
  'noc',
  'noreply',
  'no-reply',
  'office',
  'postmaster',
  'privacy',
  'registrar',
  'root',
  'sales',
  'security',
  'spam',
  'support',
  'sysadmin',
  'tech',
  'undisclosed-recipients',
  'unsubscribe',
  'usenet',
  'uucp',
  'webmaster',
  'www',
] as const;

/**
 * CSV template variable pattern for manual email mode.
 */
export const TEMPLATE_VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

/**
 * Supported template variables and their lead field mappings.
 */
export const TEMPLATE_VARIABLES: Record<string, string> = {
  business_name: 'businessName',
  first_name: 'firstName',
  website: 'website',
  category: 'category',
  city: 'city',
  state: 'state',
  country: 'country',
  notes: 'notes',
  sender_name: '_senderName',
  company_name: '_companyName',
};

/**
 * CSV formula injection prefixes to escape during export.
 * Prevents spreadsheet formula injection attacks.
 */
export const CSV_INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'] as const;
