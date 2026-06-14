# FoundryOS — Platform Setup Guide

**Version:** 1.1 | **Stack:** Next.js · Neon · Clerk · Vercel · Cloudflare · Resend · Textbelt · DigitalOcean · GitHub

This guide walks through provisioning every service and wiring them together for a new FoundryOS platform. Follow the steps in order — later steps depend on earlier ones.

---

## Table of Contents

1. [Pre-Flight Checklist](#1-pre-flight-checklist)
2. [GitHub — Create the Repository](#2-github--create-the-repository)
3. [Neon — Provision the Database](#3-neon--provision-the-database)
4. [Clerk — Set Up Authentication](#4-clerk--set-up-authentication)
5. [Resend — Configure Email](#5-resend--configure-email)
6. [Textbelt — Configure SMS](#6-textbelt--configure-sms)
7. [Cloudflare — DNS & Proxy](#7-cloudflare--dns--proxy)
8. [Vercel — Deploy the App](#8-vercel--deploy-the-app)
9. [DigitalOcean — VPS for Background Jobs](#9-digitalocean--vps-for-background-jobs)
10. [Local Development Setup](#10-local-development-setup)
11. [First Deployment Checklist](#11-first-deployment-checklist)
12. [Adding a New Cron Job](#12-adding-a-new-cron-job)
13. [Adding a New GitHub Actions Sync](#13-adding-a-new-github-actions-sync)
14. [Secrets Reference](#14-secrets-reference)
15. [Incident & Alert System](#15-incident--alert-system)

---

## 1. Pre-Flight Checklist

Before starting, ensure you have accounts for:

- [ ] GitHub (code repository)
- [ ] Neon (neon.tech — Postgres database)
- [ ] Clerk (clerk.com — authentication)
- [ ] Vercel (vercel.com — hosting)
- [ ] Cloudflare (cloudflare.com — DNS)
- [ ] Resend (resend.com — email)
- [ ] Textbelt (textbelt.com — SMS)
- [ ] DigitalOcean (digitalocean.com — VPS, if needed)
- [ ] Password Manager (for storing secrets)
- [ ] dbmate installed (postgres.js projects only — see README)

Have your password manager open before you start. Every secret you generate goes in it **immediately**.

> **Windows developers:** You will see LF/CRLF warnings on first commit. These are harmless
> but add a `.gitattributes` file (included in the starter kit) to prevent them on future commits.
> Also note that some commands in this guide use Unix syntax (`cp`, `mkdir -p`) —
> use PowerShell equivalents (`Copy-Item`, `New-Item -ItemType Directory -Force`) where needed.

---

## 2. GitHub — Create the Repository

### 2.1 Create the repo

1. Go to github.com/new
2. **Repository name:** `your-project-name` (kebab-case)
3. **Visibility:** Private
4. Do NOT initialize with README (the starter kit has one)
5. Click **Create repository**

### 2.2 Push the starter kit

```bash
# Clone the starter kit and re-point the remote
git clone https://github.com/your-org/foundryos-starter your-project-name
cd your-project-name
git remote set-url origin https://github.com/your-org/your-project-name.git
git push -u origin main
```

### 2.3 Add GitHub Actions secrets

Go to: **Settings → Secrets and variables → Actions → New repository secret**

Add these now (you'll fill in values as you provision services):

| Secret name | Where to get the value |
|---|---|
| `APP_SYNC_SECRET` | Generate: `node -e "const c=require('crypto');console.log(c.randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | Neon console (step 3) |

> Save `APP_SYNC_SECRET` in Norton immediately after generating it.

---

## 3. Neon — Provision the Database

### 3.1 Create the project

1. Log into [neon.tech](https://neon.tech)
2. **New Project** → Name it to match your project
3. **Region:** Choose closest to your Vercel deployment region (usually `us-east-1`)
4. **Postgres version:** Use the default (latest)

### 3.2 Get both connection strings

Neon gives you two connection strings and you need both:

| String | Variable | Used by | Why |
|---|---|---|---|
| **Pooled** (has `-pooler` in hostname) | `DATABASE_URL` | App at runtime, Vercel | Handles concurrent connections efficiently |
| **Direct** (no pooler) | `DATABASE_URL_DIRECT` | Migrations only | Migrations need a persistent connection; pooled drops mid-migration |

To get them:
1. Go to your Neon project → **Connection Details**
2. Copy the **Pooled** connection string → this is `DATABASE_URL`
3. Toggle to **Direct** connection → copy that string → this is `DATABASE_URL_DIRECT`

Both look like: `postgresql://user:password@host/dbname?sslmode=require`
The pooled one has `-pooler` in the hostname. The direct one does not.

### 3.3 Save secrets

Store in your password manager under your project name:
- `DATABASE_URL` → pooled connection string
- `DATABASE_URL_DIRECT` → direct connection string

Add `DATABASE_URL` to GitHub Actions secrets now (step 2.3).

### 3.4 Run migrations

Once your local environment is set up (step 10), run:

```bash
npm run db:migrate    # Applies migrations using DATABASE_URL_DIRECT
npm run db:seed       # Seeds reference/lookup data
```

---

## 4. Clerk — Set Up Authentication

### 4.1 Create the application

1. Log into [clerk.com](https://clerk.com)
2. **Create application** → name it after your project
3. Choose sign-in options (Email + Google recommended)
4. Skip the quickstart — you're using the starter kit

### 4.2 Get API keys

**Dashboard → Configure → API Keys:**

| Key | Variable name |
|---|---|
| Publishable key | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |
| Secret key | `CLERK_SECRET_KEY` |

Save both in Norton immediately.

### 4.3 Configure roles (Organizations)

If your app has multiple user types (admin, member, etc.):

1. Go to **Configure → Organizations** → Enable Organizations
2. Go to **Configure → Roles** → Create roles matching what's in `src/app/page.js`:
   - `admin`
   - `member`
   - Add others as needed

### 4.4 Configure redirect URLs

**Configure → Restrictions → Allowed redirect URLs:**

Add your production domain: `https://yourdomain.com`

### 4.5 Set up a webhook (optional, for user sync)

If you need to sync Clerk user events to your database:

1. **Configure → Webhooks → Add endpoint**
2. URL: `https://yourdomain.com/api/webhooks/clerk`
3. Select events: `user.created`, `user.deleted`, `organization.created`
4. Copy the signing secret → save as `CLERK_WEBHOOK_SECRET` in Norton

---

## 5. Resend — Configure Email

### 5.1 Add your domain

1. Log into [resend.com](https://resend.com)
2. **Domains → Add domain** → enter `yourdomain.com`
3. Resend will show you DNS records to add — do this in step 7 (Cloudflare)

### 5.2 Create an API key

**API Keys → Create API key:**
- Name: `your-project-production`
- Permission: Full access

Save in Norton as `RESEND_API_KEY`.

### 5.3 Verify the sending address

After adding DNS records, verify the domain. Your `ALERT_FROM_EMAIL` must use this domain:

```
alerts@yourdomain.com
```

---

## 6. Textbelt — Configure SMS

1. Go to [textbelt.com](https://textbelt.com)
2. Purchase credits (start with a small amount)
3. Copy your API key → save as `TEXTBELT_API_KEY` in Norton
4. Set `ALERT_PHONE_NUMBER` in E.164 format: `+15551234567`

> SMS fires only for "problem alerts" (multiple concurrent incidents). Budget accordingly.

---

## 7. Cloudflare — DNS & Proxy

### 7.1 Add your domain

1. Log into [cloudflare.com](https://cloudflare.com)
2. **Add a site** → enter your domain
3. Choose the **Free** plan
4. Cloudflare will scan existing records
5. Update your domain registrar's nameservers to Cloudflare's

### 7.2 Add DNS records

Add these records (from Vercel and Resend):

**For Vercel deployment:**
| Type | Name | Value |
|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com` |
| A | `@` | `76.76.21.21` |

**For Resend email (they'll give you exact values):**
| Type | Name | Value |
|---|---|---|
| TXT | `@` | SPF record from Resend |
| TXT | `resend._domainkey` | DKIM key from Resend |
| MX | `@` | MX record from Resend (if needed) |

### 7.3 SSL/TLS settings

**SSL/TLS → Overview:** Set mode to **Full (strict)**

### 7.4 Enable proxying

For the `www` and `@` records, ensure the orange cloud (proxy) is enabled. This gives you DDoS protection and hides your origin IP.

---

## 8. Vercel — Deploy the App

### 8.1 Import the project

1. Log into [vercel.com](https://vercel.com)
2. **Add New → Project**
3. Import from GitHub → select your repo
4. **Framework preset:** Next.js (auto-detected)
5. **Root directory:** `.` (default)

### 8.2 Set environment variables

Before deploying, go to **Settings → Environment Variables** and add:

| Variable | Value | Environment |
|---|---|---|
| `DATABASE_URL` | Neon pooled connection string | Production, Preview |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | From Clerk | All |
| `CLERK_SECRET_KEY` | From Clerk | Production, Preview |
| `RESEND_API_KEY` | From Resend | Production |
| `ALERT_FROM_EMAIL` | `alerts@yourdomain.com` | Production |
| `ALERT_TO_EMAIL` | Your alert email | Production |
| `TEXTBELT_API_KEY` | From Textbelt | Production |
| `ALERT_PHONE_NUMBER` | E.164 phone | Production |
| `CREDENTIAL_ENCRYPTION_KEY` | Generated base64 key | Production, Preview |
| `APP_SYNC_SECRET` | Generated hex secret | Production, Preview |
| `APP_NAME` | Your app name | All |
| `APP_URL` | `https://yourdomain.com` | Production |

> **Preview vs Production:** Set sensitive keys (API keys, DB) on Production only. Set non-sensitive config on All.

### 8.3 Add your custom domain

**Settings → Domains → Add** → enter `yourdomain.com` and `www.yourdomain.com`

Vercel will show you DNS values — you should have already added these in Cloudflare (step 7.2).

### 8.4 Deploy

Click **Deploy**. The `vercel-build` script in `package.json` runs `prisma generate && next build` automatically.

### 8.5 Configure cron jobs

Cron jobs are defined in `vercel.json`. Vercel runs them automatically based on the schedule. No additional setup needed — just make sure `APP_SYNC_SECRET` is set.

---

## 9. DigitalOcean — VPS for Background Jobs

Use DigitalOcean when a job needs:
- Browser automation (Playwright)
- Long-running processes (>30 seconds)
- File system access
- Persistent connections

For most FoundryOS apps, **GitHub Actions is preferred** over a VPS for background jobs (simpler, no server to maintain). Use DigitalOcean only when GitHub Actions is insufficient.

### 9.1 Create a Droplet

1. Log into [digitalocean.com](https://digitalocean.com)
2. **Create → Droplet**
3. **OS:** Ubuntu 24.04
4. **Size:** Basic — $6/month (1 vCPU, 1GB RAM) is usually enough
5. **Authentication:** SSH Key (add your public key)
6. **Hostname:** `your-project-worker`

### 9.2 Initial server setup

```bash
ssh root@your-droplet-ip

# Update packages
apt update && apt upgrade -y

# Install Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Create a non-root user for the app
adduser appuser
usermod -aG sudo appuser
```

### 9.3 Deploy the sync scripts

```bash
# As appuser:
git clone https://github.com/your-org/your-project.git /home/appuser/app
cd /home/appuser/app

# Create .env file with required vars
nano .env
# Add: APP_SYNC_SECRET, DATABASE_URL, APP_URL

# Install dependencies
npm install
```

### 9.4 Set up cron with PM2 (if not using GitHub Actions)

```bash
# Start a script with PM2
pm2 start scripts/example-sync.js --name "example-sync" --cron "*/5 * * * *"
pm2 save
pm2 startup  # Follow the output instructions to auto-start on reboot
```

---

## 10. Local Development Setup

### 10.1 Clone and install

```bash
# Clone the starter kit into your new project folder
git clone https://github.com/blackhollowsw/foundryos_starter your-project-name
cd your-project-name

# Re-point git remote to your new project repo
git remote set-url origin https://github.com/blackhollowsw/your-project-name.git
git push -u origin main

# Install dependencies
npm install
```

### 10.2 Set up environment files

Next.js reads `.env.local`. dbmate (for postgres.js projects) reads `.env`.
Keep both — both are gitignored and safe.

```bash
# Copy the template
cp .env.example .env.local

# Fill in .env.local — required at minimum:
#   DATABASE_URL                        (pooled Neon connection string)
#   DATABASE_URL_DIRECT                 (direct Neon connection string)
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   (from Clerk dashboard)
#   CLERK_SECRET_KEY                    (from Clerk dashboard)
#   APP_NAME                            (your app name)
#   APP_URL                             (your production URL)

# Copy for dbmate (postgres.js projects only)
cp .env.local .env          # Mac/Linux
Copy-Item .env.local .env   # Windows PowerShell
```

### 10.3 Add .gitattributes (Windows developers — do this once)

If you're on Windows, add a `.gitattributes` file to prevent LF/CRLF
line ending issues. The starter kit includes one — just make sure it
was committed. Check with:

```bash
git show HEAD:.gitattributes
```

If it's missing, copy it from the starter kit and commit it before
any other changes.

### 10.4 Run migrations and seed

**Prisma projects:**
```bash
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Apply migrations
npm run db:seed       # Seed reference data
```

**postgres.js projects:**
```bash
# Verify dbmate is installed (see README postgres.js branch section)
dbmate -e DATABASE_URL_DIRECT status   # Should show: Applied: 0 / Pending: 0

# Apply migrations
npm run db:migrate

# Seed reference data
npm run db:seed
```

> **dbmate troubleshooting:**
> - `invalid url` error → dbmate can't find `.env`. Run with explicit flag:
>   `dbmate --env-file .env.local -e DATABASE_URL_DIRECT status`
> - `could not find migrations directory` → create `db/migrations/` folder first
> - Make sure you're using `DATABASE_URL_DIRECT` (not pooled) for migrations

### 10.5 Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 11. First Deployment Checklist

After following all steps above, verify:

- [ ] App loads at `https://yourdomain.com`
- [ ] Sign-in works (Clerk redirects correctly)
- [ ] Role-based redirect works after sign-in
- [ ] Cron routes return 401 without Bearer token
- [ ] Cron routes return 200 with correct `APP_SYNC_SECRET`
- [ ] Database queries work (admin screen loads data)
- [ ] Email sends correctly (trigger a test alert)
- [ ] DNS resolves correctly (check with `dig yourdomain.com`)
- [ ] SSL certificate is active (HTTPS works)
- [ ] `VERCEL_ENV=preview` skips cron jobs on preview deployments

---

## 12. Adding a New Cron Job

Cron jobs are Vercel API routes called on a schedule.

### Step 1: Create the route

Copy `src/app/api/cron/example-sync/route.js` to your new path:

```
src/app/api/cron/your-job-name/route.js
```

Update `JOB_NAME` and `JOB_LABEL` constants, and replace the job logic in the `try` block.

### Step 2: Add to vercel.json

```json
{
  "crons": [
    { "path": "/api/cron/your-job-name", "schedule": "*/5 * * * *" }
  ]
}
```

[Cron schedule reference](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

### Step 3: Deploy

Push to main — Vercel will pick up the new cron automatically on next deploy.

---

## 13. Adding a New GitHub Actions Sync

Use GitHub Actions for jobs that need Playwright or exceed Vercel's function timeout.

### Step 1: Create the script

Copy `scripts/example-sync.js` to `scripts/your-sync.js`. Implement your logic.

### Step 2: Create the workflow

Copy `.github/workflows/example-sync.yml` to `.github/workflows/your-sync.yml`.

Update:
- `name:` — human-readable job name
- `cron:` — the schedule
- The script step: `run: node scripts/your-sync.js`
- The screenshot artifact name

### Step 3: Add secrets to GitHub

Go to **Settings → Secrets → Actions** and ensure `APP_SYNC_SECRET` is set.

Add any additional secrets your script needs (e.g. `DATABASE_URL`).

### Step 4: Push and verify

Push to main. Go to **Actions** tab in GitHub to see the workflow run.

---

## 14. Secrets Reference

All secrets are stored in Norton under your project name.

| Secret | Used by | How to generate |
|---|---|---|
| `DATABASE_URL` | App, migrations, VPS scripts | Neon console |
| `DATABASE_URL_DIRECT` | Local migrations | Neon console |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Frontend | Clerk dashboard |
| `CLERK_SECRET_KEY` | Backend | Clerk dashboard |
| `RESEND_API_KEY` | Email alerts | Resend dashboard |
| `TEXTBELT_API_KEY` | SMS alerts | textbelt.com |
| `CREDENTIAL_ENCRYPTION_KEY` | Encrypted DB fields | `node -e "const c=require('crypto');console.log(c.randomBytes(32).toString('base64'))"` |
| `APP_SYNC_SECRET` | Cron Bearer auth | `node -e "const c=require('crypto');console.log(c.randomBytes(32).toString('hex'))"` |

> **Key rotation:** If you rotate `CREDENTIAL_ENCRYPTION_KEY`, all encrypted values in the database become unreadable. You must decrypt all values before rotating, then re-encrypt with the new key. Plan this carefully.

---

## 15. Incident & Alert System

The starter kit includes a built-in incident detection and alerting system, carried over from Actionboard.

### How it works

Every background job calls two functions from `src/lib/cronIncident.js`:

```js
// On failure:
await recordFailure({ jobName, jobLabel, errorMessage });

// On success:
await recordSuccess({ jobName, jobLabel });
```

**Incident lifecycle:**

```
Job fails once     → consecutive_fails = 1 (silent)
Job fails twice    → consecutive_fails = 2 (silent)
Job fails 3rd time → incident opens, alert email sent
Job fails again    → already open, no duplicate alert
Job succeeds       → incident closes, all-clear email sent
```

**Problem alerts** (email + SMS) fire when 3+ incidents are open simultaneously.

### Viewing incidents

Query `cron_incidents` in Neon or Prisma Studio:

```sql
SELECT * FROM cron_incidents WHERE closed_at IS NULL ORDER BY opened_at DESC;
```

### Adjusting thresholds

In `src/lib/cronIncident.js`:
```js
const FAILURE_THRESHOLD = 3;  // failures before opening incident
```

In `src/lib/comms.js`:
```js
const PROBLEM_THRESHOLD = 3;  // open incidents before SMS fires
```

---

## Appendix: Stack Decision Notes

| Service | Why |
|---|---|
| **Vercel** | Zero-config Next.js deployment, built-in cron, preview environments |
| **Neon** | Serverless Postgres — scales to zero, branches for preview DBs |
| **Clerk** | Handles auth, orgs, roles, MFA without building any of it |
| **Cloudflare** | Free DDoS protection, proxy, DNS — always sit in front of Vercel |
| **Resend** | Modern developer-friendly email API, generous free tier |
| **Textbelt** | Simple pay-per-SMS, no monthly minimum |
| **DigitalOcean** | Predictable pricing for persistent VPS when needed |
| **GitHub Actions** | Free CI/CD, runs Playwright scraping jobs on schedule |
| **Norton** | Team-accessible secrets storage (vs. ad-hoc sharing) |