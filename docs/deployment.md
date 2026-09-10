# OmniSentinel: Production Deployment & Operations Runbook

**System:** OmniSentinel (Autonomous Multi-Source Intent-First Tracker)  
**Author:** Senior DevOps & Infrastructure Team  
**Status:** PRODUCTION READY  
**Topology:** Hybrid Distributed (Vercel Frontend + Railway/Render Docker Backend + Supabase PostgreSQL + Upstash Redis)

---

## 1. Production Architecture Overview

OmniSentinel is architected for zero maintenance overhead, high availability, and horizontal scaling by cleanly decoupling presentation, stateless API routing, and bounded background execution:

* **Frontend Dashboard:** Next.js 14 App Router deployed serverlessly on **Vercel** edge network.
* **API Gateway:** Fastify HTTP server deployed as a container on **Railway** or **Render**, exposing `/api/v1/monitors`, `/api/v1/intent/parse`, and `/health`.
* **Asynchronous Queue Workers:** BullMQ worker pool (`ExecutionWorker`, `NotificationWorker`, `SchedulerWorker`) running either embedded in the API container (`START_WORKERS=true`) or as an isolated worker container.
* **Data Storage:** Managed PostgreSQL on **Supabase** (queried via Drizzle ORM through connection pooler).
* **Distributed Broker:** Managed Redis on **Upstash** with TLS encryption (`rediss://`).
* **Visual Proof CDN:** **Cloudinary** media storage for cryptographic screenshot buffers.
* **Alert Delivery:** **Telegram Bot API** (real-time chat pings) + **Brevo REST API** (transactional dark-mode HTML emails).

---

## 2. Environment Variables Specification

All deployment environments require the following configuration keys:

| Key | Description | Example / Format |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime mode | `production` |
| `PORT` | API Server listening port | `4000` |
| `HOST` | Host interface binding | `0.0.0.0` |
| `MOCK_MODE` | Pluggable mock toggle | `false` (in production) |
| `START_WORKERS` | Embed workers in API process | `true` (for single-container deploy) |
| `DATABASE_URL` | Supabase IPv4 Pooler connection | `postgresql://postgres.[ref]:[pass]@[pooler-host]:5432/postgres` |
| `REDIS_URL` | Upstash TLS Redis connection | `rediss://default:[pass]@[host].upstash.io:6379` |
| `GEMINI_API_KEY` | Google Gemini AI Flash Key | `AIzaSy...` |
| `GEMINI_MODEL` | Gemini model identifier | `gemini-3.6-flash` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot token from @BotFather | `8930297076:AA...` |
| `BREVO_API_KEY` | Brevo v3 REST API Key | `xkeysib-...` |
| `BREVO_SENDER_EMAIL` | Verified sender email in Brevo | `alerts@omnisentinel.dev` |
| `BREVO_SENDER_NAME` | Display name for alert emails | `OmniSentinel Alerts` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name | `moadmw4k` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `317868767978114` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | `Im25YrP...` |
| `NEXT_PUBLIC_API_URL` | Frontend link to Fastify API | `https://api.omnisentinel.dev` |

---

## 3. Deployment Runbooks

### 3.1 Cloud Database & Redis Setup

**Supabase PostgreSQL Setup:**
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings** $\to$ **Database** $\to$ **Connection Pooling**.
3. Select **Session Pooler** on port `5432` with IPv4 routing.
4. Run migrations from the repository root:
   ```bash
   bun run db:migrate
   ```
5. Optionally seed baseline demo data:
   ```bash
   bun run --cwd apps/server tsx src/db/seed.ts
   ```

**Upstash Redis Setup:**
1. Create a Redis database at [upstash.com](https://upstash.com).
2. Select TLS-enabled connection URL starting with `rediss://`.
3. Test connectivity locally:
   ```bash
   bun run cli:test verify-live
   ```

---

### 3.2 Backend API & Worker Deployment (Railway / Render)

**Option A: Railway One-Click Deploy:**
1. Fork or push your OmniSentinel repo to GitHub.
2. Link the repository on [railway.app](https://railway.app).
3. Railway detects `railway.json` and builds via `apps/server/Dockerfile`.
4. In Railway **Variables**, paste all keys from `.env`. Ensure `START_WORKERS=true`.
5. Under **Settings** $\to$ **Networking**, generate a public domain (e.g., `api.up.railway.app`).

**Option B: Render Docker Service:**
1. Connect repo on [render.com](https://render.com).
2. Create a **Web Service** using Docker runtime pointing to `apps/server/Dockerfile`.
3. Set environment variables. Ensure `START_WORKERS=true` so the scheduler and workers run inside the free tier web container.
4. Set Health Check path to `/health`.

---

### 3.3 Frontend Deployment (Vercel)

1. Import the repository on [vercel.com](https://vercel.com).
2. Set **Root Directory** to `apps/web`.
3. Framework Preset will auto-detect **Next.js**.
4. In **Environment Variables**, add:
   * `NEXT_PUBLIC_API_URL`: URL of your deployed Railway/Render backend (e.g. `https://api.omnisentinel.dev` or `https://...railway.app`).
5. Click **Deploy**. Vercel will build the standalone Next.js App Router bundle in ~40 seconds.

---

### 3.4 Local & Self-Hosted Docker Compose

To run the complete production-grade system on any Linux VPS or local Docker engine:

1. Clone the repository and configure `.env`:
   ```bash
   cp .env.example .env
   # Edit .env with your live keys
   ```

2. Spin up all containers in detached mode:
   ```bash
   docker compose up --build -d
   ```

3. Monitor container health and worker output:
   ```bash
   docker compose logs -f api worker
   ```

4. Verify service availability:
   * Web Dashboard: `http://localhost:3000`
   * API Gateway Health: `http://localhost:4000/health`

---

## 4. Operational Diagnostics & Monitoring

OmniSentinel provides a built-in diagnostic suite to verify operational integrity at any time:

* **Unified System Diagnostics:**
  ```bash
  bun run cli:test verify-live
  ```
  Runs live health checks across Supabase, Upstash Redis, Telegram Bot, Brevo Email, Cloudinary CDN, and Gemini Flash AI.

* **Targeted Dispatcher Verification:**
  ```bash
  bun run cli:test verify-telegram --chat <YOUR_TELEGRAM_CHAT_ID>
  bun run cli:test verify-brevo --email <YOUR_EMAIL>
  bun run cli:test verify-cloudinary
  bun run cli:test verify-gemini "Check gold price above 75000 INR"
  ```

* **Automated Integration Tests:**
  ```bash
  bun run --cwd apps/server test:api
  ```
