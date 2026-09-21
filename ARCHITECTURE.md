# Shaliach AI — System Architecture

**FixHubTech Outreach & Sales Intelligence Platform**

---

## 1. High-Level Architecture Overview

Shaliach AI is designed as an asynchronous, event-driven monolith and worker pipeline configured across a monorepo. It cleanly separates HTTP ingress, background compute, state storage, and user interface.

```text
┌─────────────────────────────────────────────────────────────┐
│                   Joshua Caleb (Browser)                    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / Cookies
                               ▼
               ┌───────────────────────────────┐
               │    Next.js Web (Vercel)       │
               │    app.fixhubtech.com         │
               └───────────────┬───────────────┘
                               │ REST API
                               ▼
               ┌───────────────────────────────┐
               │    Nginx Reverse Proxy        │
               │    api.fixhubtech.com         │
               └───────────────┬───────────────┘
                               │ Fastify Adapter
                               ▼
               ┌───────────────────────────────┐
               │      NestJS API Backend       │
               └───────┬───────────────┬───────┘
                       │               │
        ┌──────────────┴──────┐        │ Enqueue Jobs
        │                     │        ▼
        ▼                     ▼ ┌──────────────┐
┌──────────────┐     ┌──────────────┐│ Redis BullMQ │
│  PostgreSQL  │     │Cloudflare R2 │└──────┬───────┘
│ (18 Models)  │     │ (CSV Files)  │       │
└──────────────┘     └──────────────┘       ▼
                                     ┌──────────────┐
                                     │BullMQ Workers│
                                     └──┬────────┬──┘
                                        │        │
                                        ▼        ▼
                                      Groq    Resend
```

---

## 2. Queue & Worker Topology

All long-running, CPU-intensive, or rate-limited external network tasks are offloaded to **BullMQ** running over Redis.

| Queue Name | Worker Concurrency | Rate Limiter | Description |
| :--- | :--- | :--- | :--- |
| `csv-import` | 2 | None | Streams CSVs from R2 in 1,000-row chunks, validates syntax, suppresses, and bulk inserts. |
| `ai-generation` | 5 | 30 req/min | Personalizes outreach via Groq LLaMA-3.3-70B with retries, exponential backoff, and fallback model. |
| `email-send` | 3 | 50 req/sec | Enforces pre-send suppression checks, compiles CAN-SPAM footers, and delivers through Resend. |
| `webhook-processing`| 10 | None | Ingests Resend delivery, bounce, complaint, open, and click events with automatic suppression. |
| `inbound-email` | 5 | None | Matches conversation threads, calls Groq to classify prospect intent, and drafts contextual replies. |
| `analytics` | 1 | None | Periodic rollup worker refreshing dashboard cache keys in Redis. |

---

## 3. Database Entity Relationship Model

The schema ([`packages/database/prisma/schema.prisma`](file:///packages/database/prisma/schema.prisma)) includes 18 models:

- `User`: Single administrative user (Joshua Caleb) with bcrypt password hash and session tracking.
- `SenderProfile`: Verified sender identities (`joshua@mail.fixhubtech.com`, daily limits).
- `LeadList`: Grouping metadata for uploaded CSV files.
- `Lead`: Core prospect entity with contact details, normalization, `ValidationStatus`, `CrmStatus`, and revenue metrics.
- `ImportJob`: Progress tracking for CSV streaming imports.
- `ImportRow`: Audit log of individual row validation outcomes and failure explanations.
- `Campaign`: Outreach campaign definitions, schedule, AI guidelines, and mode.
- `CampaignRecipient`: Join table linking Lead to Campaign with lifecycle states (`PENDING`, `READY_FOR_REVIEW`, `APPROVED`, `SENT`, `SUPPRESSED`).
- `AiGeneration`: Audit log of prompt, raw JSON response, model name, tokens, confidence, and warnings.
- `EmailMessage`: Sent and draft email records with Resend provider IDs and timestamps.
- `EmailEvent`: Webhook events linked to specific email messages (delivered, opened, clicked, bounced, complained).
- `Conversation`: Threaded inbound and outbound message history with a lead.
- `InboundMessage`: Raw inbound prospect replies with AI classification and draft responses.
- `SuppressionEntry`: Normalized email blacklist preventing all future communications.
- `WebhookEvent`: Raw webhook payloads for idempotency verification.
- `AuditLog`: Immutable ledger of user and automated actions.
- `RevenueEntry`: Confirmed project income records tied to won CRM leads.
- `Setting`: Key-value application configuration store.
