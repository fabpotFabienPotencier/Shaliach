# Shaliach AI — Environment Variables Guide

This document catalogs every environment variable used in Shaliach AI, its intended format, and which services depend on it.

---

## Variable Reference Table

| Variable | Description | Example Format | Used By |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Application environment (`development` / `production` / `test`) | `production` | All |
| `PORT` | HTTP port for the NestJS API | `3001` | API |
| `APP_URL` | Public frontend URL of the Next.js app | `https://app.fixhubtech.com` | API, Worker |
| `API_URL` | Public backend URL of the NestJS API | `https://api.fixhubtech.com` | API, Web |
| `NEXT_PUBLIC_API_URL` | Client-side API URL exposed to browser React code | `https://api.fixhubtech.com` | Web |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/shaliach_db?schema=public` | API, Worker, Database |
| `REDIS_URL` | Redis connection string with optional authentication | `redis://:password@localhost:6379/0` | API, Worker |
| `SESSION_SECRET` | 32+ character random string for signing cookies and HMAC tokens | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | API, Worker |
| `ENCRYPTION_KEY` | 32-byte hex string for AES-256 field encryption | `603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4` | API |
| `GROQ_API_KEY` | Official Groq API Key | `gsk_...` | API, Worker |
| `GROQ_MODEL` | Primary LLaMA inference model ID | `llama-3.3-70b-versatile` | Worker |
| `GROQ_FALLBACK_MODEL` | Fallback inference model ID for rate limits / timeouts | `llama-3.1-8b-instant` | Worker |
| `GROQ_MAX_TOKENS` | Maximum completion output tokens | `1000` | Worker |
| `GROQ_TEMPERATURE` | Sampling temperature (0.0 to 1.0) | `0.4` | Worker |
| `RESEND_API_KEY` | Resend API Key | `re_...` | API, Worker |
| `RESEND_WEBHOOK_SECRET` | Resend / Svix webhook verification secret | `whsec_...` | API, Worker |
| `RESEND_FROM_EMAIL` | Default verified From address | `Joshua Caleb <joshua@mail.fixhubtech.com>` | API, Worker |
| `RESEND_REPLY_TO` | Default Reply-To address | `joshua@reply.fixhubtech.com` | API, Worker |
| `R2_ENDPOINT` | Cloudflare R2 S3-compatible endpoint | `https://<account_id>.r2.cloudflarestorage.com` | API, Worker |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API Token Access Key | `...` | API, Worker |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API Token Secret Key | `...` | API, Worker |
| `R2_BUCKET` | Cloudflare R2 bucket name | `shaliach-uploads` | API, Worker |
| `SENTRY_DSN` | Sentry DSN endpoint for production exception tracking | `https://...@o0.ingest.sentry.io/...` | API |
