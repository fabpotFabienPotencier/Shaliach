import { getEnvConfig } from './env';

export interface DatabaseConfig {
  url: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  const env = getEnvConfig();
  return {
    url: env.DATABASE_URL,
  };
}
