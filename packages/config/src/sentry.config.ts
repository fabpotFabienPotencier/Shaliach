import { getEnvConfig } from './env';

export interface SentryConfig {
  dsn: string;
  enabled: boolean;
  environment: string;
}

export function getSentryConfig(): SentryConfig {
  const env = getEnvConfig();
  return {
    dsn: env.SENTRY_DSN,
    enabled: !!env.SENTRY_DSN,
    environment: env.NODE_ENV,
  };
}
