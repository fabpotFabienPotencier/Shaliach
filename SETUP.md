# Shaliach AI — Local Setup Guide

Follow this step-by-step guide to configure and launch Shaliach AI locally on your computer.

---

## 1. Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v20.x` or higher
- **pnpm**: `v9.x` (`npm install -g pnpm`)
- **PostgreSQL**: `v16.x` running on port `5432`
- **Redis**: `v7.x` running on port `6379`

---

## 2. Environment Configuration

1. Copy the example environment template:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your local PostgreSQL credentials, Redis connection string, Groq API key, and Resend API credentials.

---

## 3. Dependency Installation

Install all monorepo dependencies:
```bash
pnpm install
```

---

## 4. Database Setup & Migrations

1. Generate the Prisma Client:
   ```bash
   pnpm db:generate
   ```

2. Run the database migrations:
   ```bash
   pnpm db:migrate
   ```

3. Seed the database with the initial Joshua Caleb account and default FixHubTech sender profile:
   ```bash
   pnpm db:seed
   ```
   *(Default credentials created by seed: Email `joshua@fixhubtech.com` / Password `changeme`)*

---

## 5. Running the Application

Open 3 terminal windows to run the development servers concurrently:

### Terminal 1: NestJS API Backend
```bash
pnpm dev:api
```
*API will start on `http://localhost:3001`*

### Terminal 2: BullMQ Worker Process
```bash
pnpm dev:worker
```
*Background worker will connect to Redis and begin listening for jobs*

### Terminal 3: Next.js Frontend
```bash
pnpm dev:web
```
*Web dashboard will be accessible at `http://localhost:3000`*

---

## 6. First Login & Verification

1. Navigate to `http://localhost:3000` in your web browser.
2. Sign in with `joshua@fixhubtech.com` and password `changeme`.
3. Go to **Settings > Account Security** and change your password immediately.
4. Upload `test/fixtures/sample-leads.csv` in the **Imports** tab to run the first acceptance test.
