import { getEnvConfig } from './env';

export interface RedisConfig {
  url: string;
  host: string;
  port: number;
  password: string | undefined;
}

export function getRedisConfig(): RedisConfig {
  const env = getEnvConfig();
  const url = new URL(env.REDIS_URL);

  return {
    url: env.REDIS_URL,
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
  };
}
