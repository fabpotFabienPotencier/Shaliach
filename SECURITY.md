# Shaliach AI — Security & Compliance Model

This document outlines the security controls, secrets management, data protection practices, and CAN-SPAM compliance architecture implemented in Shaliach AI.

---

## 1. Authentication & Session Security

- **Single-User Architecture**: Only the authorized account (Joshua Caleb) can access administrative endpoints.
- **Password Hashing**: Passwords are encrypted using **bcrypt** with a salt work factor of 12.
- **HTTP-Only Cookies**: Authentication session IDs are transmitted exclusively via `httpOnly`, `secure` (in production), `sameSite: 'lax'` cookies, preventing cross-site scripting (XSS) extraction.
- **Session Caching in Redis**: Session tokens are verified against Redis with a 7-day time-to-live (TTL). Invalid or expired tokens are immediately rejected.
- **Audit Logging**: Every login attempt, password update, import, and bulk action is recorded in the immutable `AuditLog` table with client IP addresses and user agents.

---

## 2. Ingress & API Protection

- **Helmet Security Headers**: Strict Content-Security-Policy (CSP), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Strict-Transport-Security` headers are enforced by Fastify and Nginx.
- **Rate Limiting**: Configured at both Nginx (100 req/sec) and Fastify (100 req/min general, 5 req/min on `/api/auth/login`) to guard against brute-force and DDoS vectors.
- **CORS Allowlist**: Cross-Origin requests are strictly restricted to `https://app.fixhubtech.com` and configured local origins in development.
- **Zod Runtime DTO Validation**: All request payloads are validated and stripped of extraneous properties before hitting service logic.

---

## 3. CSV Injection Protection

When exporting leads, rejected rows, or suppression lists to CSV files, formula injection characters (`=`, `+`, `-`, `@`, `\t`, `\r`) at the beginning of any cell value are prefixed with a single quote (`'`) via `sanitizeCsvField()` to prevent spreadsheet formula execution in Microsoft Excel or Google Sheets.

---

## 4. CAN-SPAM & Delivery Compliance

- **Mandatory Approval Workflow**: AI-generated emails are placed in the `Approval Queue` and cannot be sent without explicit human review and approval.
- **Physical Mailing Address**: Every rendered email template includes FixHubTech's postal address in the footer.
- **Signed One-Click Unsubscribe**: Every outgoing email contains an HMAC-SHA256 signed unsubscribe URL.
- **Automated Suppression**: Any spam complaint, hard bounce, or opt-out keyword response immediately adds the normalized address to the `SuppressionEntry` table and cancels all future scheduled messages.

---

## 5. Secrets Management Checklist

- [x] Zero hard-coded credentials or API keys in source files.
- [x] Passwords, Groq keys, Resend keys, and R2 credentials read exclusively from validated environment variables via `@shaliach/config`.
- [x] Log scrubbers prevent printing API keys or authorization headers to stdout/stderr.
- [x] Cloudflare R2 original files uploaded over TLS with restricted IAM bucket credentials.
