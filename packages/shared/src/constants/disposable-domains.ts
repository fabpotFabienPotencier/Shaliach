/**
 * Known disposable/temporary email domains.
 * Emails from these domains are flagged as INVALID during validation.
 *
 * This is a curated subset. In production, consider using a maintained
 * list like github.com/disposable-email-domains/disposable-email-domains
 */
export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  '0-mail.com',
  '10minutemail.com',
  '20minutemail.com',
  'byom.de',
  'deadaddress.com',
  'dispostable.com',
  'dodgeit.com',
  'emailigo.de',
  'fakeinbox.com',
  'filzmail.com',
  'getairmail.com',
  'getnada.com',
  'grr.la',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'jetable.org',
  'mailcatch.com',
  'maildrop.cc',
  'mailexpire.com',
  'mailfence.com',
  'mailinator.com',
  'mailnesia.com',
  'mailnull.com',
  'mailsac.com',
  'mailslurp.com',
  'mailtemp.info',
  'mailtothis.com',
  'mintemail.com',
  'mohmal.com',
  'mytemp.email',
  'mytrashmail.com',
  'nomail.xl.cx',
  'nospam.ze.tc',
  'owlpic.com',
  'proxymail.eu',
  'sharklasers.com',
  'spam4.me',
  'spambog.com',
  'spambox.us',
  'spamcowboy.com',
  'spamfree24.org',
  'spamgourmet.com',
  'temp-mail.org',
  'tempail.com',
  'tempemail.co.za',
  'tempinbox.com',
  'tempmail.com',
  'tempmail.net',
  'tempomail.fr',
  'temporaryemail.net',
  'temporarymail.org',
  'throwam.com',
  'throwaway.email',
  'trashmail.com',
  'trashmail.me',
  'trashmail.net',
  'trashymail.com',
  'yopmail.com',
  'yopmail.fr',
]);

/**
 * Check if an email domain is a known disposable provider.
 */
export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}
