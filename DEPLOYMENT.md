# Shaliach AI — Zero-Disruption VPS Deployment Guide
### Subdomain: `shaliach.fixhubtech.com` (Live `fixhubtech.com` Website Remains 100% Untouched)

> [!IMPORTANT]
> **Zero Disruption Guarantee for `fixhubtech.com`:**
> Your existing website (`fixhubtech.com`, `www.fixhubtech.com`, existing web server) will **NEVER be modified or touched**.
> Shaliach AI operates solely under the subdomain: **`shaliach.fixhubtech.com`** and **`api.shaliach.fixhubtech.com`** hosted on your new Ubuntu VPS.

---

## 🗺️ Domain & Network Routing

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        DNS (fixhubtech.com)                            │
├─────────────────────────────────┬──────────────────────────────────────┤
│ fixhubtech.com (Main Site)      │  UNTOUCHED (Points to existing host) │
│ www.fixhubtech.com              │  UNTOUCHED (Points to existing host) │
├─────────────────────────────────┼──────────────────────────────────────┤
│ shaliach.fixhubtech.com         │  ► CNAME to Vercel (or A to VPS)     │
│ api.shaliach.fixhubtech.com     │  ► A Record to YOUR NEW UBUNTU VPS   │
│ mail.fixhubtech.com             │  ► Resend SPF/DKIM (Sending Domain)  │
│ reply.fixhubtech.com            │  ► Resend Inbound MX (Replies)       │
└─────────────────────────────────┴──────────────────────────────────────┘
```

---

## 🛠️ Step 1: Add DNS Subdomains Only (In Your DNS Manager)

Open Cloudflare, Namecheap, GoDaddy, Hostinger, or wherever your DNS for `fixhubtech.com` is managed. Add **ONLY** these subdomains:

### 1. Shaliach Subdomain Records
| Type | Name / Host | Target / Value | Purpose |
| :--- | :--- | :--- | :--- |
| **A** | `api.shaliach` (or `shaliach-api`) | `YOUR_NEW_VPS_IP` | Points API to your new Ubuntu VPS |
| **CNAME** | `shaliach` | `cname.vercel-dns.com` | Points Web Dashboard to Vercel |

### 2. Email Delivery Subdomains (Resend)
| Type | Name / Host | Target / Value | Purpose |
| :--- | :--- | :--- | :--- |
| **TXT** | `mail` | `v=spf1 include:resend.com ~all` | Sending domain SPF |
| **TXT** | `resend._domainkey` | `k=rsa; p=...` (from Resend) | DKIM signature |
| **MX** | `mail` | `feedback-smtp.us-east-1.amazonses.com` (10) | Sending MX |
| **MX** | `reply` | `feedback-smtp.us-east-1.amazonses.com` (10) | Inbound reply MX |

*(If using Cloudflare, set the `api.shaliach` A record to **DNS Only / Grey Cloud** during SSL generation).*

---

## 🖥️ Step 2: SSH into Your New Ubuntu VPS & Configure Firewall

Open Terminal or PowerShell on your computer:

```bash
ssh root@YOUR_NEW_VPS_IP
```

Update packages and configure the UFW firewall:
```bash
apt update && apt upgrade -y
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Install Docker, Docker Compose, Git, and Certbot:
```bash
apt install -y docker.io docker-compose-plugin git certbot curl
systemctl enable --now docker
```

---

## 🔒 Step 3: Issue Free SSL Certificate for `shaliach.fixhubtech.com`

Run Certbot standalone to generate the certificate:

```bash
certbot certonly --standalone -d api.shaliach.fixhubtech.com -d shaliach.fixhubtech.com --non-interactive --agree-tos -m joshua@fixhubtech.com
```

Certificates are created safely at:
```text
/etc/letsencrypt/live/shaliach.fixhubtech.com/fullchain.pem
/etc/letsencrypt/live/shaliach.fixhubtech.com/privkey.pem
```

---

## 📦 Step 4: Clone Code & Configure `.env` on Your VPS

### 1. Push code from your laptop to a GitHub private repo:
*(Inside `c:\xampp\htdocs\SHALIACH`)*
```bash
git init
git add .
git commit -m "feat: shaliach production ready"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/shaliach.git
git push -u origin main
```

### 2. Clone on your Ubuntu VPS:
```bash
cd /opt
git clone https://github.com/YOUR_GITHUB_USERNAME/shaliach.git
cd /opt/shaliach
cp .env.example .env
nano .env
```

### 3. Set your production values:
```env
NODE_ENV=production
PORT=3001
APP_URL=https://shaliach.fixhubtech.com
API_URL=https://api.shaliach.fixhubtech.com

# Database (Internal to Docker)
POSTGRES_USER=shaliach
POSTGRES_PASSWORD=YourStrongDatabasePassword123!
POSTGRES_DB=shaliach_prod
DATABASE_URL=postgresql://shaliach:YourStrongDatabasePassword123!@postgres:5432/shaliach_prod?schema=public

# Redis (Internal to Docker)
REDIS_PASSWORD=YourStrongRedisPassword456!
REDIS_URL=redis://:YourStrongRedisPassword456!@redis:6379/0

# Security Secrets
SESSION_SECRET=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
ENCRYPTION_KEY=603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4

# Groq API
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=llama-3.1-8b-instant
GROQ_MAX_TOKENS=1000
GROQ_TEMPERATURE=0.4

# Resend Email
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_WEBHOOK_SECRET=whsec_your_webhook_secret_here
RESEND_FROM_EMAIL="Joshua Caleb <joshua@mail.fixhubtech.com>"
RESEND_REPLY_TO="joshua@reply.fixhubtech.com"

# Cloudflare R2
R2_ENDPOINT=https://your_cloudflare_account_id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET=shaliach-uploads
```
Press `CTRL + O`, `Enter` to save, then `CTRL + X` to exit.

---

## 🚀 Step 5: Start Docker Stack & Migrate Database

### 1. Launch containers:
```bash
docker compose up -d --build
```

### 2. Run Prisma migrations and seed the initial admin user:
```bash
docker compose exec api pnpm --filter @shaliach/database run migrate
docker compose exec api pnpm --filter @shaliach/database run seed
```

### 3. Verify backend health probe:
```bash
curl -i https://api.shaliach.fixhubtech.com/api/health
```
*(Returns `HTTP 200 {"status":"healthy", ...}`)*

---

## 🌐 Step 6: Deploy Frontend to Vercel (`shaliach.fixhubtech.com`)

1. In [Vercel](https://vercel.com), import your `shaliach` GitHub repository.
2. Set **Root Directory** to `apps/web`.
3. Add Environment Variable:
   - **Name:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://api.shaliach.fixhubtech.com`
4. Deploy and go to **Project Settings > Domains** and add:
   - `shaliach.fixhubtech.com`

---

## 🔔 Step 7: Configure Resend Webhook

In your [Resend Dashboard](https://resend.com/webhooks):
1. Add endpoint: `https://api.shaliach.fixhubtech.com/api/webhooks/resend`
2. Select all event types (`email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`).
3. Copy the signing secret (`whsec_...`) into `/opt/shaliach/.env` as `RESEND_WEBHOOK_SECRET`.
4. Restart containers:
   ```bash
   docker compose restart api worker
   ```

---

## 🎉 Done! You Are Live at `shaliach.fixhubtech.com`

- Open **`https://shaliach.fixhubtech.com/login`**
- Sign in with `joshua@fixhubtech.com` / `changeme`
- Change your password in **Settings > Account Security**
- Your main website **`fixhubtech.com`** continues running completely undisturbed!
