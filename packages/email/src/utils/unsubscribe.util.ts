import * as crypto from 'crypto';

export interface UnsubscribeTokenPayload {
  email: string;
  leadId: string;
  campaignId?: string;
  timestamp: number;
}

export function generateUnsubscribeToken(
  payload: UnsubscribeTokenPayload,
  secretKey: string,
): string {
  const jsonStr = JSON.stringify(payload);
  const base64Data = Buffer.from(jsonStr).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(base64Data)
    .digest('base64url');

  return `${base64Data}.${signature}`;
}

export function verifyAndParseUnsubscribeToken(
  token: string,
  secretKey: string,
): UnsubscribeTokenPayload | null {
  try {
    const [base64Data, signature] = token.split('.');
    if (!base64Data || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(base64Data)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const jsonStr = Buffer.from(base64Data, 'base64url').toString('utf8');
    return JSON.parse(jsonStr) as UnsubscribeTokenPayload;
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(
  appUrl: string,
  token: string,
): string {
  const cleanAppUrl = appUrl.replace(/\/+$/, '');
  return `${cleanAppUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}
