# Shaliach AI — Manual Commands Catalog

> [!IMPORTANT]
> **Workstation Safety Assurance:**
> None of the terminal commands below were automatically executed during the build.
> Joshua Caleb should review and run these commands as needed.

---

## 1. Installation Commands

Install all monorepo workspace dependencies:
```bash
# Install pnpm globally if not already present
npm install -g pnpm

# Install all workspace dependencies
pnpm install
```

---

## 2. Database & Prisma Commands

Commands for schema management, migrations, and database seeding:

```bash
# Generate the Prisma Client
pnpm --filter @shaliach/database run generate

# Create and apply a new database migration
pnpm --filter @shaliach/database run migrate

# Push schema directly to database (useful for prototyping)
pnpm --filter @shaliach/database run db:push

# Seed the database with default user (Joshua Caleb), sender profile, and settings
pnpm --filter @shaliach/database run seed

# Open Prisma Studio web inspector to browse raw database records
pnpm --filter @shaliach/database run studio
```

---

## 3. Development Commands

Run applications and workers in hot-reloading development mode:

```bash
# Start all services concurrently (API, Web, Worker)
pnpm dev

# Start individual services:
pnpm dev:api      # Starts NestJS API on http://localhost:3001
pnpm dev:web      # Starts Next.js Web on http://localhost:3000
pnpm dev:worker   # Starts BullMQ Worker daemon
```

---

## 4. Build Commands

Compile all packages and applications for production:

```bash
# Build entire monorepo
pnpm build

# Build individual applications
pnpm --filter @shaliach/api run build
pnpm --filter @shaliach/worker run build
pnpm --filter @shaliach/web run build
```

---

## 5. Test Commands

Execute test suites:

```bash
# Run all unit and integration tests across the monorepo
pnpm test

# Run API E2E tests
pnpm --filter @shaliach/api test:e2e

# Run validation unit tests
pnpm --filter @shaliach/shared test
```

---

## 6. Docker & Production Commands

Commands for running the backend stack inside Docker on Ubuntu AWS:

```bash
# Build and start all production containers in detached mode
docker compose up -d --build

# View real-time logs from all services
docker compose logs -f

# View logs from a specific container (e.g., worker)
docker compose logs -f worker

# Stop all running containers
docker compose down

# Check container health status
docker compose ps
```

---

## 7. First Acceptance Test Execution Procedure (§36)

Follow this manual test flow to verify the entire system end-to-end:

1. **Start Services**: Run `pnpm dev:api`, `pnpm dev:worker`, and `pnpm dev:web`.
2. **Log In**: Open `http://localhost:3000` and log in with `joshua@fixhubtech.com` / `changeme`.
3. **Upload CSV**: Navigate to **Imports**, click **Import New Leads CSV**, select `test/fixtures/sample-leads.csv`, map the columns, and start the import.
4. **Inspect Validation**: Confirm that 80 valid leads, 10 duplicate rows, 5 malformed syntax rows, and 5 invalid domain rows were detected.
5. **Create Campaign**: Go to **Campaigns**, create an AI Personalized campaign targeting the newly imported list with 5 daily sends.
6. **Generate Drafts**: Click **Generate Drafts** to trigger the Groq AI worker.
7. **Review & Approve**: Go to **Approval Queue**, inspect the 5 generated emails, edit 1 draft, and click **Approve** on all 5.
8. **Verify Delivery**: Check the **Dashboard** and **Leads** table to see delivery status updates and Resend event tracking.
