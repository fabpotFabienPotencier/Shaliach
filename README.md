# Shaliach AI
### FixHubTech Outreach & Sales Intelligence

**Owner:** Joshua Caleb · **Company:** FixHubTech · **Website:** [fixhubtech.com](https://fixhubtech.com)

---

## Overview

**Shaliach AI** is a private, production-grade AI-powered outreach and sales management platform designed to turn raw business lead CSV files into hyper-personalized email campaigns, manage human-in-the-loop approvals, track delivery events, process inbound replies with AI classification, and drive prospects through the FixHubTech sales pipeline to closed revenue.

---

## Core System Architecture

```text
app.fixhubtech.com (Vercel / Next.js)
        │
        ▼ (HTTPS REST API / Secure Cookies)
api.fixhubtech.com (Nginx Reverse Proxy)
        │
        ▼
NestJS + Fastify Backend (Port 3001)
        │
  ┌─────┼─────────────────────┐
  ▼     ▼                     ▼
Postgres Redis (BullMQ)     Cloudflare R2
         │
       ┌─┴────────────────────────────┐
       ▼                              ▼
  Groq AI Worker (LLaMA 3.3)    Resend Email Delivery Worker
```

---

## Repository Structure

```text
shaliach/
├── apps/
│   ├── api/          # NestJS + Fastify REST Backend
│   ├── web/          # Next.js 14 App Router Frontend
│   └── worker/       # BullMQ Background Job Processors (6 Workers)
│
├── packages/
│   ├── ai/           # Groq SDK Integration & Prompt Engineering
│   ├── config/       # Validated Type-Safe Environment Accessors
│   ├── database/     # Prisma ORM Schema (18 Models) & Seeds
│   ├── email/        # Resend SDK Integration, HTML/Text Templates
│   ├── shared/       # TypeScript Types, Enums, Constants, Zod Schemas
│   └── ui/           # Shared Tailwind & Radix UI Component Library
│
├── infrastructure/
│   ├── docker/       # Dockerfile.api & Dockerfile.worker
│   └── nginx/        # Reverse proxy & SSL configurations
│
├── docs/             # Technical specifications & design docs
│
├── test/
│   └── fixtures/     # 100-row lead CSV & mock payload fixtures
│
├── .env.example      # Environment variable template
├── docker-compose.yml# Production container orchestration
├── package.json      # Monorepo root manifest
├── pnpm-workspace.yaml
├── ARCHITECTURE.md   # Complete system architecture guide
├── SETUP.md          # Local development guide
├── MANUAL_COMMANDS.md# All commands for Joshua Caleb to run manually
├── ENVIRONMENT.md    # Environment variable reference
├── DEPLOYMENT.md     # Production deployment guide
└── SECURITY.md       # Security and compliance guide
```

---

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 14, React 18, Tailwind CSS, Radix UI, TanStack Query |
| **Backend** | NestJS, Fastify Adapter, TypeScript, Zod |
| **Database** | PostgreSQL 16, Prisma ORM |
| **Queues** | Redis 7, BullMQ |
| **AI Inference** | Groq API (`llama-3.3-70b-versatile`, fallback `llama-3.1-8b-instant`) |
| **Email Delivery** | Resend API & Svix Webhook Verification |
| **Object Storage**| Cloudflare R2 (S3-compatible) |
| **Monitoring** | Sentry, Structured JSON Logging, Heartbeat Probes |
| **Reverse Proxy** | Nginx with TLS 1.3 & Rate Limiting |

---

## Getting Started

Refer to [SETUP.md](SETUP.md) for local installation instructions and [MANUAL_COMMANDS.md](MANUAL_COMMANDS.md) for the complete list of commands to run.
