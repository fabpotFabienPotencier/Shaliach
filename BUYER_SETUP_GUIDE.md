# Shaliach AI — Quick Start & Deployment Guide ⚡

Welcome to **Shaliach AI**! This guide walks you through deploying your private instance in under 3 minutes using Docker.

---

## 🛠️ Prerequisites
- A VPS or local machine with **Docker** and **Docker Compose** installed (Ubuntu 22.04+ or macOS/Linux).
- Free account keys (all have generous free tiers):
  - **Groq API Key** (Free from [console.groq.com](https://console.groq.com))
  - **Resend API Key** (Free from [resend.com](https://resend.com) — 3,000 free emails/mo)
  - **Telegram Bot Token & Chat ID** (Free via `@BotFather` and `@userinfobot`)

---

## 🚀 3-Minute 1-Click Deployment

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/Shaliach.git
cd Shaliach
```

### 2. Configure Environment Variables
Copy the template `.env`:
```bash
cp .env.example .env
nano .env
```
Fill in your keys:
```env
# Database & Redis Passwords
POSTGRES_PASSWORD=your_secure_password
REDIS_PASSWORD=your_secure_password

# Groq AI
GROQ_API_KEY=gsk_your_groq_key
GROQ_MODEL=openai/gpt-oss-120b
GROQ_FALLBACK_MODEL=openai/gpt-oss-20b

# Resend Email Sending
RESEND_API_KEY=re_your_resend_key
RESEND_FROM_EMAIL="Your Name <outreach@yourdomain.com>"
RESEND_REPLY_TO="outreach@yourdomain.com"

# Telegram Bot Alerts
TELEGRAM_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_telegram_id_from_userinfobot
```

### 3. Launch with Docker Compose
```bash
docker compose up -d
```

That’s it! Docker will pull and boot:
- **`shaliach-postgres`** (Port 5432)
- **`shaliach-redis`** (Port 6379)
- **`shaliach-api`** (FastAPI REST backend on Port 3001)
- **`shaliach-worker`** (Autonomous lead finder, AI drip sender, and Telegram bot)

---

## 📱 Verifying Telegram Bot Cockpit

Open Telegram, find your bot, and send:
```
/ping
```
It will reply immediately:
`🏓 Pong! VPS server and worker are fully active.`

Other available commands:
- `/stats` — Live pipeline statistics (Total leads, emails sent today, replies).
- `/find <niche> in <city> [limit]` — e.g. `/find roofing in Dallas 10`
- `/pause` / `/resume` — Pause or resume automated outreach.

---

## 🔒 Production Deliverability Best Practices
To ensure 100% primary inbox delivery with Resend:
1. In your DNS provider (Cloudflare / Namecheap / GoDaddy), verify:
   - **DKIM:** TXT record provided by Resend (`resend._domainkey`).
   - **SPF:** TXT record `v=spf1 include:amazonses.com ~all`.
   - **DMARC:** TXT record `_dmarc.yourdomain.com` with `v=DMARC1; p=none;`.
2. Safe drip cadence: The default worker safely drips 1 email every 6–10 minutes (max 40/day) during business hours to protect sender reputation.
