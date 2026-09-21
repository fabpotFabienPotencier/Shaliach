import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Validated Environment Configuration
// ═══════════════════════════════════════════════════════════════

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://localhost:6379'),

  // Authentication
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  CSRF_SECRET: z.string().min(16, 'CSRF_SECRET must be at least 16 characters'),
  COOKIE_DOMAIN: z.string().default('localhost'),

  // Groq AI
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_FALLBACK_MODEL: z.string().default('llama-3.1-8b-instant'),
  GROQ_MAX_TOKENS: z.coerce.number().int().min(100).max(4096).default(500),
  GROQ_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.4),

  // Resend Email
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  RESEND_WEBHOOK_SECRET: z.string().min(1, 'RESEND_WEBHOOK_SECRET is required'),
  RESEND_FROM_EMAIL: z.string().default('Joshua Caleb <joshua@mail.fixhubtech.com>'),
  RESEND_REPLY_TO: z.string().email().default('joshua@reply.fixhubtech.com'),

  // Cloudflare R2
  R2_ENDPOINT: z.string().min(1, 'R2_ENDPOINT is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET: z.string().default('shaliach-uploads'),

  // Sentry
  SENTRY_DSN: z.string().optional().default(''),

  // Rate Limiting
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().default(5),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(900000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().default(100),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60000),

  // Queue Configuration
  IMPORT_CHUNK_SIZE: z.coerce.number().int().min(100).max(5000).default(1000),
  AI_GENERATION_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),
  EMAIL_SEND_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(5),
  EMAIL_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(200),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

/**
 * Load and validate environment configuration.
 * Throws on invalid/missing required variables.
 * Caches result for subsequent calls.
 */
export function loadEnvConfig(): EnvConfig {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n❌ Invalid environment configuration:\n${errors}\n\n` +
      `Copy .env.example to .env and fill in the required values.\n`
    );
  }

  _config = result.data;
  return _config;
}

/**
 * Get environment config (must be loaded first).
 */
export function getEnvConfig(): EnvConfig {
  if (!_config) {
    return loadEnvConfig();
  }
  return _config;
}

/**
 * Check if running in production.
 */
export function isProduction(): boolean {
  return getEnvConfig().NODE_ENV === 'production';
}

/**
 * Check if running in development.
 */
export function isDevelopment(): boolean {
  return getEnvConfig().NODE_ENV === 'development';
}

/**
 * Check if running in test.
 */
export function isTest(): boolean {
  return getEnvConfig().NODE_ENV === 'test';
}
