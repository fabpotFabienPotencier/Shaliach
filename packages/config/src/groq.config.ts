import { getEnvConfig } from './env';

export interface GroqConfig {
  apiKey: string;
  model: string;
  fallbackModel: string;
  maxTokens: number;
  temperature: number;
}

export function getGroqConfig(): GroqConfig {
  const env = getEnvConfig();
  return {
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_MODEL,
    fallbackModel: env.GROQ_FALLBACK_MODEL,
    maxTokens: env.GROQ_MAX_TOKENS,
    temperature: env.GROQ_TEMPERATURE,
  };
}
