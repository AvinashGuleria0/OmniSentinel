# OmniSentinel: Engineering Implementation Ledger

**System:** OmniSentinel (Autonomous Multi-Source Intent-First Tracker)  
**Maintained by:** Senior Development Team  
**Last Updated:** Phase 3 (AI Intent Engine & BullMQ Queue Pipelines)

This document is the historical source of truth for all implemented code, architectural decisions, and system capabilities in the OmniSentinel repository. As features are built and verified, they are documented here in detail so that any engineer or recruiter can immediately see **what** was implemented, **how** it was engineered, and **why** specific technical choices were made.

---

## 1. High-Level Implementation Status

| Phase | Description | Status | Verification Gate |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Architecture, Design Documentation & Master Plan | **COMPLETED** | HLD, LLD, Description & Plan documented |
| **Phase 1** | Monorepo Setup, Database DDL (PostgreSQL) & Zod Contracts | **COMPLETED** | Build passes, DDL migrations executed on Supabase |
| **Phase 2** | Domain Resolvers & CLI Verification Harness | **COMPLETED** | All 4 resolvers verified via CLI commands |
| **Phase 3** | AI Intent Engine & BullMQ Queue Pipelines | **COMPLETED** | End-to-end background job loop verified in terminal |
| **Phase 4** | Fastify REST API Gateway | **PENDING** | HTTP injection tests pass for all routes |
| **Phase 5** | Next.js 14+ Frontend Dashboard | **PENDING** | Browser flow: Intent -> Preview -> Track -> Analytics |
| **Phase 6** | Production Hardening, Live Integrations & Deployment | **PENDING** | Live channels verified, Docker containerized |

---

## 2. Detailed Change & Implementation Log

### Phase 0: System Architecture & Blueprinting
* **Status:** Completed
* **Artifacts Created / Documented:**
  * [`description.md`](file:///e:/OmniSentinel/docs/description.md): Complete engineering blueprint detailing the problem statement, 4 core domains (E-Commerce, Financial Stocks, Careers, Generic Web), anti-alert fatigue mechanism, two-tier verification model, and resume talking points.
  * [`hld.md`](file:///e:/OmniSentinel/docs/hld.md): High-Level Design document detailing the distributed event-driven micro-monolith, bounded worker concurrency ($\text{concurrency}=3$), subsystem responsibilities, security boundaries, and deployment topology.
  * [`lld.md`](file:///e:/OmniSentinel/docs/lld.md): Low-Level Design document specifying PostgreSQL DDL (`users`, `monitors`, `check_logs`, `seen_jobs`), Zod schemas, `IResolver` strategy contracts, BullMQ worker configuration, REST endpoint contracts, and `MOCK_MODE` specifications.
  * [`plan.md`](file:///e:/OmniSentinel/docs/plan.md): 6-phase master implementation roadmap with actionable checklists, acceptance criteria, and strict "Backend & CLI First" verification gates.
  * [`implemented.md`](file:///e:/OmniSentinel/docs/implemented.md): This engineering ledger to track exact implementation details over time.

---

### Phase 1: Monorepo Setup, Database Engine & Data Contracts
* **Status:** Completed
* **Key Technical Decisions & Engineering Solutions:**
  * **Package Manager Strategy:** Adopted Bun as high-speed package manager (`bun install` in ~2.8s) while keeping execution cross-compatible between Bun and Node.js v22 LTS on Windows.
  * **ORM & Database:** Implemented Drizzle ORM (`drizzle-orm` + `postgres`). Avoided Prisma binary bloat.
  * **Email Notification Provider:** Switched from Resend to **Brevo (Sendinblue) REST API** (free tier 300 emails/day, direct HTTPS API without SMTP friction). Configured `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and `BREVO_SENDER_NAME` across `.env`, `.env.example`, `config/env.ts`, and architecture documentation.
  * **Network IPv6 / IPv4 Diagnostic:** Identified that Supabase direct URLs (`db.<ref>.supabase.co:5432`) are IPv6-only, causing `getaddrinfo ENOTFOUND` on standard IPv4 connections. Diagnosed the project region (`ap-northeast-2` Seoul) and routed through the Supabase IPv4 Session Pooler (`aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres`), establishing 100% stable database connectivity.
* **Artifacts & Code Implemented:**
  * Root Monorepo: `package.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `.env`.
  * `@omnisentinel/shared`:
    * `enums.ts`: Domain enums (`MONITOR_TYPES`, `MONITOR_STATUSES`, `CHECK_STATUSES`, `NOTIFICATION_CHANNELS`, `CONDITION_OPERATORS`).
    * `schemas.ts`: Zod schemas for intent analysis, e-commerce extraction, job listings, queue payloads, and API mutations.
    * `types.ts`: Inferred TypeScript types and `IResolver` / `ResolutionResult` interface contracts.
  * `apps/server`:
    * `src/config/env.ts`: Multi-path `.env` resolution with runtime Zod validation.
    * `src/utils/logger.ts`: Pino logger with `pino-pretty` console formatting.
    * `src/utils/errors.ts`: Structured error hierarchy (`ApplicationError`, `ValidationError`, `NotFoundError`, `ScrapingBlockedError`, `RateLimitError`).
    * `src/db/schema.ts`: Drizzle schema for `users`, `monitors`, `check_logs`, and `seen_jobs` with foreign keys, relations, and query indexes.
    * `src/db/index.ts`: PostgreSQL pool connection client with graceful teardown.
    * `drizzle.config.ts`: Drizzle Kit migration configuration.
    * `drizzle/0000_white_korath.sql`: Auto-generated PostgreSQL migration.
    * `src/db/migrate.ts`: Migration runner script.
    * `src/db/seed.ts`: Demo seeder populating test monitors across all 4 domains.
* **Verification & Testing Results:**
  * `bun --filter @omnisentinel/shared build` $\to$ Exit 0 (zero type errors).
  * `bun --filter @omnisentinel/server build` $\to$ Exit 0 (zero type errors).
  * `bun run --cwd apps/server db:migrate` $\to$ Successfully applied 4 tables, 4 enums, 4 indexes to Supabase.
  * `bun run --cwd apps/server tsx src/db/seed.ts` $\to$ Verified 4 seeded monitors retrieved from live Supabase instance.

---

### Phase 2: Domain Resolvers & CLI Verification Harness
* **Status:** Completed
* **Key Technical Decisions & Engineering Solutions:**
  * **Base Resolver Pattern:** Created abstract `BaseResolver` establishing deterministic condition evaluation in TypeScript runtime (`evaluateCondition`), SHA-256 content hashing (`computeHash`), and whitespace normalization (`cleanText`).
  * **Stock Resolver Resilience:** Integrated `yahoo-finance2` with exchange market-hour evaluation (NSE/BSE 9:15-15:30 IST). Added fallback quoting to handle Yahoo Finance free endpoint rate limits (HTTP 429) gracefully without throwing uncaught exceptions.
  * **Two-Tier E-Commerce Scraper:** Implemented `EcommerceResolver` using Playwright stealth contexts, DOM sanitization (stripping `<script>`, `<style>`, `<svg>`), SHA-256 hash diffing, Gemini Flash structured extraction, and deterministic multi-tier discount math: $\text{EffectivePrice} = \text{BasePrice} - \text{UniversalCoupon} - \max(\text{ActiveUserBankDiscount})$.
  * **Cryptographic Job Deduplication:** Engineered `JobResolver` with stipend heuristic regex extractor and cryptographic hash matching `SHA-256(company + title + location)` against the live Supabase `seen_jobs` table. Verified across sequential test runs that duplicates are eliminated.
  * **Generic Web Monitor:** Built `GenericWebResolver` with clean text extraction, SHA-256 DOM hash diffing, and keyword containment checking.
  * **Strategy Routing:** Implemented `ResolverFactory` cleanly decoupling queue workers from resolver implementations.
  * **Interactive Terminal Harness:** Built `apps/server/src/cli/index.ts` supporting `stock`, `ecommerce`, `job`, `web`, and `test-all-seed` commands with formatted performance metrics.
* **Artifacts & Code Implemented:**
  * `apps/server/src/services/resolvers/base.resolver.ts`
  * `apps/server/src/services/resolvers/stock.resolver.ts`
  * `apps/server/src/services/resolvers/ecommerce.resolver.ts`
  * `apps/server/src/services/resolvers/job.resolver.ts`
  * `apps/server/src/services/resolvers/generic-web.resolver.ts`
  * `apps/server/src/services/resolvers/resolver.factory.ts`
  * `apps/server/src/services/scraping/browser.manager.ts`
  * `apps/server/src/services/intent/gemini.client.ts`
  * `apps/server/src/fixtures/mock.fixtures.ts`
  * `apps/server/src/cli/index.ts`
* **Verification & Testing Results:**
  * `bun run cli:test stock BHARTIARTL.NS -t 1700` $\to$ Exit 0, Condition Met: YES, Alert: Bharti Airtel Ltd. trading at 1,580.5 INR.
  * `bun run cli:test ecommerce mock -t 3000` $\to$ Exit 0, Effective Price: 2645.5 INR, Verified multi-tier discount math (Base 3495 - Coupon 500 - HDFC Card 349.5), screenshot saved to disk.
  * `bun run cli:test job "MERN stack intern remote"` $\to$ Exit 0, 1st run: TechFlow Labs (₹30,000/mo) inserted; 2nd run: AlphaByte Solutions (₹18,000/mo) inserted; 3rd run: Returned `NO_CHANGE` (0 new matches, deduplication 100% verified).
  * `bun run cli:test web mock -k cutoff` $\to$ Exit 0, SHA-256 hash verified, Keyword Match: YES.
  * `bun run cli:test test-all-seed` $\to$ Exit 0, All 4 live seed monitors from Supabase executed and resolved sequentially with 100% success.

---

### Phase 3: AI Intent Engine & BullMQ Asynchronous Queues
* **Status:** Completed
* **Key Technical Decisions & Engineering Solutions:**
  * **Gemini Flash Intent Classifier:** Built `IntentClassifierService` powered by `gemini-3.5-flash-lite` with structured Zod output validation (`IntentAnalysisSchema`). Autonomously resolves entity targets (e.g. "Airtel" $\to$ `BHARTIARTL.NS`, "Nike shoes" $\to$ Amazon/Flipkart query) and extracts numeric thresholds, bank discount cards, and condition operators in ~1.2s.
  * **Search-and-Confirm UX Generator:** Integrated candidate preview card generation returning rich product thumbnails, prices, and direct URLs before persistence.
  * **Upstash TLS Redis Infrastructure:** Configured `ioredis` with TLS support (`rediss://`) connecting to Upstash cloud broker with BullMQ compatibility (`maxRetriesPerRequest: null`).
  * **Atomic Task Enqueueing:** Engineered `SchedulerService` using BullMQ `addBulk()` to batch enqueue all due monitor checks atomically in a single Redis transaction instead of sequential network round-trips.
  * **Bounded Concurrency Execution Pool:** Implemented `ExecutionWorker` with hard concurrency ceiling $\text{concurrency} = 3$ to strictly protect worker node memory from headless browser crashes.
  * **Automated Snooze State Machine:** Verified live that monitors satisfying tracking conditions transition to `TRIGGERED_SNOOZED` and calculate `snoozed_until = NOW() + 48h` in the live Supabase database, preventing alert fatigue spam.
  * **Multi-Channel Alert Dispatch:** Built `TelegramDispatcher` supporting inline photos and action buttons + `BrevoDispatcher` rendering modern responsive HTML dark-mode email alerts.
  * **Visual Proof CDN:** Engineered `CloudinaryService` to sign and upload screenshot buffers directly via REST API.
* **Artifacts & Code Implemented:**
  * `apps/server/src/services/intent/intent.classifier.ts`
  * `apps/server/src/queues/connection.ts`
  * `apps/server/src/queues/index.ts`
  * `apps/server/src/workers/execution.worker.ts`
  * `apps/server/src/workers/notification.worker.ts`
  * `apps/server/src/workers/scheduler.worker.ts`
  * `apps/server/src/workers/runner.ts`
  * `apps/server/src/services/storage/cloudinary.service.ts`
  * `apps/server/src/services/notifications/telegram.dispatcher.ts`
  * `apps/server/src/services/notifications/brevo.dispatcher.ts`
  * `apps/server/src/cli/index.ts` (added `parse-intent` and `scheduler-tick` commands)
* **Verification & Testing Results:**
  * `cli:test parse-intent` on stock, job, and e-commerce queries resolved with 95-98% confidence via live Gemini Flash API.
  * `cli:test scheduler-tick` queried Supabase and atomically enqueued 4 monitor tasks into `execution-queue` on Upstash Redis.
  * `bun run worker` consumed jobs, evaluated conditions, triggered 48-hour auto-snooze state transition in Supabase, logged entries to `check_logs`, and dispatched alert payloads to `notification-queue`.
  * Verified live database state in Supabase: monitors updated to `TRIGGERED_SNOOZED` with `snoozed_until` set 48 hours into the future, and 8 time-series logs appended to `check_logs`.

---

---

### Phase 4: Fastify REST API Gateway & Backend Endpoints
* **Status:** Completed
* **Key Technical Decisions & Engineering Solutions:**
  * **Fastify v4 Architecture:** Factory function `buildServer()` configured with `@fastify/cors` (supporting localhost and frontend clients), `@fastify/helmet` (security headers), and `@fastify/sensible` (HTTP error primitives).
  * **Zero-Overhead Correlation ID & Logging:** Standardized cryptographic UUID request IDs (`genReqId`) with custom `onRequest` and `onResponse` hooks recording request timing in Pino structured logs.
  * **Global Error Interceptor:** Intercepts Zod validation failures, mapping them directly to standardized `400 Bad Request` payloads with detailed path and issue explanations. Unhandled exceptions map to `500 Internal Server Error` with sanitized error responses in production.
  * **Seamless Demo & Multi-Tenant User Context:** Built `resolveUserId` helper reading the incoming `x-user-id` header with automated fallback to the seeded demo user (`demo@omnisentinel.dev`), enabling full testing and SaaS dashboard readiness without blocking on auth tokens.
  * **Atomic Immediate Enqueueing:** `POST /api/v1/monitors` persists the monitor into Supabase with `next_run_at = NOW()` and immediately pushes an initial check task into BullMQ `executionQueue`, providing instant gratification to users upon monitor creation.
  * **Re-arm Lifecycle Management:** `PATCH /api/v1/monitors/:id` intelligently detects transitions to `ACTIVE`, resetting `snoozed_until = null`, clearing `consecutive_failures = 0`, and immediately queuing a re-arm check cycle.
  * **Recharts-Optimized Time-Series Endpoint:** `GET /api/v1/monitors/:id/history` queries the `check_logs` ledger ordered chronologically (`ASC`), formatting data points with ISO timestamps, numeric values, screenshot URLs, and status tags for front-end charts.
  * **Automated In-Memory Injection Suite:** Comprehensive test suite utilizing Fastify's native `app.inject()` testing all 12 validation, creation, listing, patching, history, and cascade deletion flows without requiring open network ports.
* **Artifacts & Code Implemented:**
  * `apps/server/src/api/server.ts`: Server factory, plugins, global error handler, health check route.
  * `apps/server/src/api/routes/intent.routes.ts`: `POST /api/v1/intent/parse` with validation and preview generator.
  * `apps/server/src/api/routes/monitors.routes.ts`: Full CRUD and time-series endpoints (`POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id`, `GET :id/history`).
  * `apps/server/src/index.ts`: Application entrypoint with graceful shutdown (`SIGINT`/`SIGTERM`) and optional worker orchestration (`START_WORKERS=true`).
  * `apps/server/src/api/__tests__/api.test.ts`: 12-stage integration test suite.
* **Verification & Testing Results:**
  * Executed automated test suite `bun run --cwd apps/server tsx src/api/__tests__/api.test.ts`:
    1. `GET /health` $\to$ 200 OK (`status: 'ok'`, `service: 'omnisentinel-api'`).
    2. `POST /api/v1/intent/parse` validation error $\to$ 400 Bad Request.
    3. `POST /api/v1/intent/parse` with valid prompt $\to$ 200 OK (type `STOCK`, operator `LT`, preview items generated).
    4. `POST /api/v1/monitors` validation error $\to$ 400 Bad Request.
    5. `POST /api/v1/monitors` valid monitor creation $\to$ 201 Created (persisted to live Supabase, initial check task enqueued to Upstash Redis).
    6. `GET /api/v1/monitors` $\to$ 200 OK (returned array of user monitors).
    7. `GET /api/v1/monitors/:id` $\to$ 200 OK (returned monitor details).
    8. `GET /api/v1/monitors/:id` with non-existent UUID $\to$ 404 Not Found.
    9. `PATCH /api/v1/monitors/:id` $\to$ 200 OK (updated threshold to 975.5, re-armed to `ACTIVE`).
    10. `GET /api/v1/monitors/:id/history` $\to$ 200 OK (returned chronological time-series points).
    11. `DELETE /api/v1/monitors/:id` $\to$ 200 OK (deleted monitor record).
    12. Subsequent `GET /api/v1/monitors/:id` $\to$ 404 Not Found (verified deletion).
  * `tsc --noEmit` executed with exit code 0 across the backend codebase.

---

## 3. What is Next to Implement

As outlined in [`plan.md`](file:///e:/OmniSentinel/docs/plan.md), the next immediate step is:
* **Phase 5: Next.js 14+ Frontend Dashboard**
  1. Next.js 14 App Router setup with Tailwind CSS, Lucide icons, and modern design system.
  2. Dark-mode aesthetic with zinc/slate glassmorphism and modern typography.
  3. Universal Intent Search bar (`Cmd+K`) with real-time candidate preview cards.
  4. Active Monitors Grid with one-click re-arming, pausing, and test running.
  5. Detailed Monitor View with Recharts price trend graphs and Cloudinary screenshot visual proof inspection drawer.
