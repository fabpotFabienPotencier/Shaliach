import { getEnvConfig } from './env';

export interface ResendConfig {
  apiKey: string;
  webhookSecret: string;
  fromEmail: string;
  replyTo: string;
}

export function getResendConfig(): ResendConfig {
  const env = getEnvConfig();
  return {
    apiKey: env.RESEND_API_KEY,
    webhookSecret: env.RESEND_WEBHOOK_SECRET,
    fromEmail: env.RESEND_FROM_EMAIL,
    replyTo: env.RESEND_REPLY_TO,
  };
}
