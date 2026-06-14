# FoundryOS Starter Kit

A production-ready foundation for new Blackhollow Studios software platforms.
Built from the patterns established in Actionboard.

## Stack

| Layer          | Service        | Purpose                                        |
|----------------|----------------|------------------------------------------------|
| Hosting        | Vercel         | Web app deployment, edge functions, cron jobs  |
| Database       | Neon (Postgres)| Serverless relational database                 |
| ORM            | Prisma         | Default. See postgres.js branch below.         |
| Auth           | Clerk          | Authentication, organizations, role-based access |
| DNS            | Cloudflare     | DNS proxy, DDoS protection, SSL                |
| Email          | Resend         | Transactional and alert emails                 |
| SMS            | Textbelt       | Text message alerts                            |
| Background Jobs| GitHub Actions | Playwright scraping, scheduled sync jobs       |
| VPS            | DigitalOcean   | Persistent workers when needed                 |
| Secrets        | Password Manager | Team API key and credential storage          |
| Repo           | GitHub         | Version control and CI/CD                      |

## Quick Start

```bash
# 1. Clone the starter and re-point to your new repo
git clone https://github.com/your-org/foundryos-starter your-project-name
cd your-project-name
git remote set-url origin https://github.com/your-org/your-project-name.git

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Fill in DATABASE_URL, DATABASE_URL_DIRECT, and Clerk keys at minimum

# 4. Set up the database
#    (Use DATABASE_URL_DIRECT in prisma.config.ts for migrations)
npm run db:migrate
npm run db:seed

# 5. Start dev server
npm run dev
```

See **[docs/SETUP.md](./docs/SETUP.md)** for the full step-by-step provisioning guide.

## Project Structure

```
foundryos-starter/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/              # Admin API routes (Clerk-protected)
│   │   │   └── cron/
│   │   │       └── example-sync/   # Template cron route
│   │   ├── sign-in/                # Clerk sign-in page
│   │   ├── sign-up/                # Clerk sign-up page
│   │   ├── layout.js               # Root layout (ClerkProvider)
│   │   ├── page.js                 # Home page + role-based redirect
│   │   └── globals.css             # Global styles
│   ├── lib/
│   │   ├── prisma.ts               # Prisma client singleton (default ORM)
│   │   ├── comms.js                # Resend email + Textbelt SMS
│   │   ├── cronIncident.js         # Incident tracking (Prisma + postgres.js)
│   │   └── credentialCrypto.js     # AES-256-GCM credential encryption
│   └── proxy.js               # Clerk auth middleware
├── prisma/
│   ├── schema.prisma               # Database schema
│   ├── seed.js                     # Reference data seeder
│   └── migrations/                 # Generated migration files (commit these)
├── scripts/
│   └── example-sync.js             # Template VPS/Actions sync script
├── .github/
│   ├── ISSUE_TEMPLATE/             # Bug report and feature request templates
│   └── workflows/
│       └── example-sync.yml        # Template GitHub Actions workflow
├── docs/
│   └── SETUP.md                    # Full provisioning guide
├── public/                         # Static assets (favicon, images)
├── build-starter.sh                # Script to build the zip artifact
├── next.config.js                  # Next.js configuration
├── vercel.json                     # Vercel cron + function config
├── prisma.config.ts                # Prisma config (uses DATABASE_URL_DIRECT)
├── .env.example                    # Environment variable template
└── .gitignore
```

## Key Scripts

```bash
npm run dev             # Local development server
npm run build           # Production build
npm run db:migrate      # Run Prisma migrations (uses DATABASE_URL_DIRECT)
npm run db:studio       # Open Prisma Studio — visual DB browser
npm run db:seed         # Seed reference data
npm run db:generate     # Regenerate Prisma client after schema changes
npm run gen:secret      # Generate a random hex secret (for APP_SYNC_SECRET)
```

## What's Included

**Auth pattern** — Clerk wraps the app via `ClerkProvider` in `layout.js`.
Middleware in `proxy.js` protects all routes except `/`, `/sign-in`,
`/sign-up`, and `/api/cron/*`. Role-based routing in `page.js` redirects
users after sign-in based on their Clerk org role.

**Cron pattern** — All cron routes validate a Bearer token against
`APP_SYNC_SECRET` and skip execution on Vercel preview deployments.
The `example-sync` route is a complete copy-paste starting point.

**Incident system** — `cronIncident.js` tracks consecutive failures per job.
At 3 failures an email alert fires. On recovery an all-clear fires.
At 3+ concurrent open incidents, SMS fires. Works with both Prisma and
postgres.js (see the postgres.js branch section below).

**Credential encryption** — `credentialCrypto.js` provides AES-256-GCM
encrypt/decrypt for sensitive values stored in the database.
Uses `CREDENTIAL_ENCRYPTION_KEY` env var.

**GitHub Actions sync** — `example-sync.yml` is a ready-to-copy workflow
for Playwright-based background jobs, including Chromium browser caching.

## Starting a New Project

1. Clone this starter into your new project folder
2. Re-point `git remote origin` to your new repo
3. Follow [docs/SETUP.md](./docs/SETUP.md) top to bottom
4. Replace the `Account` model in `prisma/schema.prisma` with your domain models
5. Update role names in `src/app/page.js` to match your Clerk org roles
6. Rename `example-sync` references to your actual job names
7. Update `APP_NAME` and `APP_URL` in `.env.local` and Vercel

---

## postgres.js Branch

Prisma is the default ORM for most Blackhollow projects. For apps that meet
any of the criteria below, use **postgres.js + dbmate** instead.

**Switch to postgres.js when the app has:**
- Stored procedures required
- Pre-computed aggregate tables
- Multi-level data isolation enforced by DB roles
- Expected public traffic at significant scale
- Complex SQL that would live in `$queryRaw` anyway

### Setting up the postgres.js branch

```bash
# Remove Prisma
npm uninstall @prisma/client @prisma/adapter-pg prisma
rm prisma/schema.prisma prisma/seed.js prisma.config.ts src/lib/prisma.ts

# Add postgres.js
npm install postgres

# Create migration folder — dbmate errors if this doesn't exist
mkdir -p db/migrations

# Update package.json scripts (replace db:* scripts):
# "db:migrate":  "dbmate -e DATABASE_URL_DIRECT up",
# "db:rollback": "dbmate -e DATABASE_URL_DIRECT down",
# "db:seed":     "psql $DATABASE_URL_DIRECT -f db/seed.sql",
# Remove: "db:generate", "db:studio"
# Update: "vercel-build": "next build"  (remove prisma generate step)
```

### Installing dbmate

**Mac:**
```bash
brew install dbmate
```

**Windows:**
1. Download `dbmate-windows-amd64.exe` from:
   `https://github.com/amacneil/dbmate/releases/latest`
2. Rename it to `dbmate.exe`
3. Create `C:\tools` and move `dbmate.exe` there
4. Add `C:\tools` to your PATH:
   Start → search "Environment Variables" → Edit system environment variables
   → Environment Variables → User variables → Path → Edit → New → `C:\tools`
5. Restart your terminal

**Linux:**
```bash
curl -fsSL -o /usr/local/bin/dbmate \
  https://github.com/amacneil/dbmate/releases/latest/download/dbmate-linux-amd64
chmod +x /usr/local/bin/dbmate
```

### Environment files and dbmate

Next.js reads `.env.local`. dbmate reads `.env`. Keep both:

```bash
# .env.local  — Next.js reads this (never committed)
# .env        — dbmate reads this (never committed)
# .gitignore already excludes both

# After filling in .env.local, copy it for dbmate:
cp .env.local .env        # Mac/Linux
Copy-Item .env.local .env # Windows PowerShell
```

Both files are gitignored — neither will be committed.

### Verify the connection

```bash
dbmate -e DATABASE_URL_DIRECT status
```

Expected output when connected with no migrations yet:
```
Applied: 0
Pending: 0
```

If you see `invalid url` — dbmate can't find your `.env` file.
Run with explicit env file instead:
```bash
dbmate --env-file .env.local -e DATABASE_URL_DIRECT status
```

### postgres.js client singleton

Create `src/lib/db.js`:

```js
// src/lib/db.js
import postgres from "postgres";

const globalForSql = globalThis;

function createClient() {
  return postgres(process.env.DATABASE_URL, {
    ssl: "require",
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10
  });
}

export const sql = globalForSql.sql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForSql.sql = sql;
export default sql;
```

### Incident tracking with postgres.js

`cronIncident.js` includes a postgres.js adapter. Use it like this:

```js
import sql from "@/lib/db";
import { makeSqlIncidentAdapter } from "@/lib/cronIncident";

const { recordFailure, recordSuccess } = makeSqlIncidentAdapter(sql);
```

### Migration files

Instead of `prisma migrate dev`, create plain SQL files:

```
db/migrations/
  20260101000000_initial_schema.sql
  20260101000001_seed_issues.sql
```

**Every migration file must start with `-- migrate:up` and end with `-- migrate:down`:**

```sql
-- migrate:up

CREATE TABLE your_table (
  ...
);

-- migrate:down
-- Intentionally empty. Rolling back destroys data.
-- To reset, drop and recreate the database in Neon.
```

dbmate tracks applied migrations in a `schema_migrations` table it manages automatically.
Each file runs exactly once. The timestamp prefix determines the order.

---

## Building the Zip Artifact

To rebuild `foundryos-starter.zip` after making changes:

```bash
# From the directory containing foundryos-starter/
chmod +x foundryos-starter/build-starter.sh
cd ..
./foundryos-starter/build-starter.sh
```

Never build the zip manually — always use `build-starter.sh` to avoid
the brace expansion directory name bug.