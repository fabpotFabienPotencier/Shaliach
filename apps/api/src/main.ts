import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import * as Sentry from '@sentry/node';
import { getEnvConfig, getSentryConfig } from '@shaliach/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const env = getEnvConfig();
  const sentryConfig = getSentryConfig();

  // Initialize Sentry error tracking
  if (sentryConfig.enabled && sentryConfig.dsn) {
    Sentry.init({
      dsn: sentryConfig.dsn,
      environment: sentryConfig.environment,
      tracesSampleRate: 1.0,
    });
    logger.log('Sentry monitoring initialized');
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: env.NODE_ENV === 'development',
      bodyLimit: 50 * 1024 * 1024, // 50MB
    }),
  );

  // Security headers with Helmet
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  });

  // CORS configuration
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow localhost in dev, and shaliach.fixhubtech.com in prod
      if (
        !origin ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin === 'https://shaliach.fixhubtech.com' ||
        origin === 'https://app.fixhubtech.com' ||
        origin === env.APP_URL ||
        origin.endsWith('.fixhubtech.com')
      ) {
        cb(null, true);
        return;
      }
      cb(new Error('CORS Not Allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Session-ID',
      'X-CSRF-Token',
      'svix-id',
      'svix-timestamp',
      'svix-signature',
    ],
  });

  // Cookie parsing with signing secret
  await app.register(fastifyCookie, {
    secret: env.SESSION_SECRET || 'shaliach-cookie-secret-key-32chars',
  });

  // Streaming multipart upload support
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB CSV files max
      files: 1,
    },
  });

  // Rate Limiting (100 requests per minute by default)
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Enable graceful shutdown
  app.enableShutdownHooks();

  const port = env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`Shaliach AI API server running on port ${port} in ${env.NODE_ENV} mode`);
}

bootstrap().catch((err) => {
  console.error('Fatal API bootstrap error:', err);
  process.exit(1);
});
