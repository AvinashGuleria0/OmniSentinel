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
| **Phase 4** | Fastify REST API Gateway | **COMPLETED** | All 12 REST API injection tests passing |
| **Phase 5** | Next.js 14+ Frontend Dashboard | **COMPLETED** | Next.js 14 App Router, intent command bar, analytics |
| **Phase 6** | Production Hardening, Live Integrations & Deployment | **COMPLETED** | Live channels verified, Dockerized, CI/CD automated |

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

### Phase 5: Next.js 14+ Frontend Dashboard
* **Status:** Completed
* **Key Technical Decisions & Engineering Solutions:**
  * **Next.js 14 App Router Architecture:** Built `apps/web` as a Next.js 14 App Router SPA. The dashboard root is a `'use client'` page using React `useState` + `useCallback` + `useEffect` for data lifecycle, with 20-second auto-refresh polling the Fastify API.
  * **Custom Tailwind Design System:** Defined a zinc/slate deep-dark palette (`#060911` base) with custom Tailwind color tokens (`sentinel.cyan`, `sentinel.emerald`, `sentinel.amber`, `sentinel.violet`, `sentinel.rose`), glassmorphism utilities (`.glass-card`, `.glass-panel`), multi-color ambient box shadow glows, and a subtle 32px cyber grid background pattern.
  * **Universal Intent Command Bar (`UniversalSearchBar`):** Full-width input bar with cyan gradient glow frame on focus. Animating placeholder text rotates through 4 realistic user prompts every 4.5 seconds. `Ctrl+K` / `Cmd+K` keyboard shortcut focuses the input globally. Domain preset chips dispatch full prompts directly to the intent classifier.
  * **Search-and-Confirm Preview Modal (`IntentPreviewModal`):** Renders the Gemini Flash intent classification output as a structured modal with: domain type badge + confidence score, extracted condition formula (`LT ₹1,600`), up to 3 interactive candidate preview cards with thumbnails and source labels, target value override input, 5-tier frequency selector buttons, bank card discount checkboxes (HDFC/ICICI/SBI/Axis), and auto-coupon toggle. "Deploy Autonomous Sentinel" persists to Supabase via `POST /api/v1/monitors` and enqueues immediate BullMQ check.
  * **Monitor Card Component (`MonitorCard`):** Status-coded animated status badges with a living pulse indicator for `ACTIVE` status. Domain icons, raw prompt display, target condition formula, last known value metric, relative time ("5m ago"), and a compact actions toolbar (Re-arm, Pause/Resume, Analytics Drawer, Delete). Hover lift transition through `.glass-card` CSS.
  * **Monitors Grid (`MonitorsGrid`):** Domain tab bar (All / Stocks / E-Commerce / Jobs / Web Scrapers) with in-memory filter + text search across title, prompt, and targetSymbol. Three-column responsive CSS Grid. Loading skeleton placeholder cards during API fetch.
  * **Monitor Analytics Drawer (`MonitorAnalyticsDrawer`):** Slide-over right-panel drawer showing: 3-column metrics header (Condition Target / Latest Recorded / Last Checked), **Recharts `LineChart`** with cyan trend line, amber `ReferenceLine` at target value, dark-themed tooltip, and custom axis labels. Visual proof Cloudinary screenshot with fullscreen lightbox on click. Chronological execution audit log table with color-coded status dots.
  * **Typed API Client (`lib/api.ts`):** Fully typed `fetch`-based HTTP client calling the Fastify backend. All operations return strongly typed `MonitorRecord` and `CheckLogPoint` interfaces. `parseIntent()` returns `ParseIntentResponse` from the shared Zod schema.
  * **Toast Notification System:** Context-based `ToastProvider` with `useToast()` hook. Three variant toasts (`success`, `error`, `info`) with icons, auto-dismiss at 4.5s, and manual close button.
* **Artifacts & Code Implemented:**
  * `apps/web/package.json`: Next.js 14, React 18, Tailwind CSS 3, Recharts, Lucide React, clsx/tailwind-merge.
  * `apps/web/tailwind.config.ts`: Custom dark palette, glow box-shadows, fade-in animation, cyber-grid background.
  * `apps/web/src/app/globals.css`: Glass morphism CSS utilities, ambient grid, custom scrollbar.
  * `apps/web/src/lib/api.ts`: Typed HTTP client for all 7 Fastify API endpoints.
  * `apps/web/src/lib/utils.ts`: `cn()` helper, `formatCurrency()`, `formatRelativeTime()`.
  * `apps/web/src/components/common/Header.tsx`: Sticky header with live API beacon and system telemetry.
  * `apps/web/src/components/common/Toast.tsx`: Context toast system with `useToast()` hook.
  * `apps/web/src/components/intent/UniversalSearchBar.tsx`: Intent command bar with `Ctrl+K`, rotating placeholders, preset chips.
  * `apps/web/src/components/intent/IntentPreviewModal.tsx`: Search-and-Confirm modal with filter controls and Deploy CTA.
  * `apps/web/src/components/monitors/MonitorCard.tsx`: Status-coded monitor card with action toolbar.
  * `apps/web/src/components/monitors/MonitorsGrid.tsx`: Domain tabs, text search, responsive grid.
  * `apps/web/src/components/analytics/MonitorAnalyticsDrawer.tsx`: Recharts analytics, visual proof screenshot, audit log.
  * `apps/web/src/app/layout.tsx`: Root layout with Toast context provider and global metadata.
  * `apps/web/src/app/page.tsx`: Main dashboard page wiring all components.
* **Verification & Testing Results:**
  * `next build` (production build): **Exit code 0** — compiled successfully with zero TypeScript errors, zero linting errors.
  * Route `/` First Load JS: 208 kB total (113 kB page bundle + 87.1 kB shared chunks).
  * Dashboard renders at `http://localhost:3000` with correct page title, hero section, search bar, and monitor grid.
  * Fastify API server confirmed running at `http://localhost:4000` — `Gateway Connected` status beacon active in the header.
  * 20-second auto-refresh polling live and loading monitors from Supabase.

---

### Phase 6: End-to-End Hardening, Live Integrations, Dockerization & CI/CD
* **Status:** Completed
* **Key Technical Decisions & Engineering Solutions:**
  * **Live Production Integrations Verification Suite:** Implemented a unified diagnostics suite in `apps/server/src/cli/index.ts` (`bun run cli:test verify-live`) testing all 5 external cloud adapters in parallel with live telemetry reporting:
    * **Supabase PostgreSQL:** Confirmed connection pooler connectivity and monitor count.
    * **Telegram Bot API:** Authenticated `@avi_omnisentinelBot` (ID: `8930297076`) via Telegram's `getMe` API with support for live test message dispatch (`verify-telegram --chat <id>`).
    * **Brevo Transactional Email:** Authenticated account (`AvinashGuleria`) and verified 300 free daily email credits via `https://api.brevo.com/v3/account` with live email sending verification (`verify-brevo --email <recipient>`).
    * **Cloudinary Visual Proof CDN:** Generated 1x1 image buffers, signed multipart upload payloads with SHA-1 cryptographic tokens, and verified secure HTTPS CDN asset generation.
    * **Gemini Flash AI Engine:** Integrated `gemini-3.6-flash` via `@google/generative-ai` with structured JSON schema output and automated `filterMetadata` normalization, achieving ~95-98% intent classification confidence with zero schema fallback failures.
  * **Multi-Stage Containerization:**
    * `apps/server/Dockerfile`: Based on `mcr.microsoft.com/playwright:v1.44.0-jammy` with Bun runtime and pre-installed Chromium headless dependencies (`PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`). Supports dual container topology: boots Fastify API by default, or dedicated BullMQ worker pool via command override `["bun", "apps/server/src/workers/runner.ts"]`.
    * `apps/web/Dockerfile`: Multi-stage Next.js 14 container utilizing Next.js `output: 'standalone'` and a secure non-root `nextjs:nodejs` system user for minimal image attack surface.
    * `docker-compose.yml`: Local full-stack orchestration declaring `api` (port 4000), `worker` (isolated process with dependency healthchecks), and `web` (port 3000) on an isolated bridge network with `.env` passthrough.
  * **Continuous Integration (CI/CD):** Engineered `.github/workflows/ci.yml` running on pull requests and branch pushes, automating dependency installation, type checking across workspaces, Fastify API integration tests (`test:api`), and Next.js production builds.
  * **Cloud Deployment Blueprints:**
    * `apps/web/vercel.json`: One-click configuration for Next.js App Router deployment on Vercel with security headers.
    * `railway.json`: Deployment configuration for Railway container runtime with `/health` probe.
    * `render.yaml`: Infrastructure-as-Code blueprint for Render Web Service with embedded BullMQ worker support (`START_WORKERS=true`).
    * `docs/deployment.md`: Comprehensive operations runbook covering Supabase, Upstash Redis, Railway, Render, Vercel, and Docker Compose VPS setups.
* **Artifacts & Code Implemented:**
  * `apps/server/src/services/intent/gemini.client.ts`: Updated model identifier to `gemini-3.6-flash` with runtime configuration support.
  * `apps/server/src/services/intent/intent.classifier.ts`: Added normalization for `filterMetadata` null values from LLMs.
  * `apps/server/src/cli/index.ts`: Added `verify-telegram`, `verify-brevo`, `verify-cloudinary`, `verify-gemini`, and `verify-live` commands.
  * `apps/server/Dockerfile`: Multi-stage backend Dockerfile with Playwright Chromium.
  * `apps/web/Dockerfile`: Multi-stage Next.js 14 standalone Dockerfile.
  * `apps/web/next.config.js`: Enabled `output: 'standalone'`.
  * `apps/web/vercel.json`: Vercel deployment specification.
  * `docker-compose.yml`: Monorepo container orchestration.
  * `.dockerignore`: Docker build exclusion rules.
  * `.github/workflows/ci.yml`: GitHub Actions automated testing and build pipeline.
  * `railway.json`: Railway container deployment schema.
  * `render.yaml`: Render web and worker blueprint.
  * `docs/deployment.md`: Operations and deployment runbook.
  * `docs/plan.md`: Updated Phase 6 checklist to completed.
* **Verification & Testing Results:**
  * `bun run cli:test verify-live` $\to$ **100% PASS** across all 5 production services:
    * Supabase PostgreSQL: Connected (5 monitors present in DB) [3023ms]
    * Telegram Bot API: `@avi_omnisentinelBot` authenticated [880ms]
    * Brevo Email API: Verified account credentials [1175ms]
    * Cloudinary CDN: Upload and signature verified [2128ms]
    * Gemini Flash AI: Intent mapped to `STOCK` with 95% confidence [13193ms]
  * `bun run --cwd apps/server test:api` $\to$ **ALL 12 REST API INTEGRATION TESTS PASSED** (Exit code 0).
  * `bun --filter @omnisentinel/web build` $\to$ **Exit code 0** with Next.js standalone output verified.

---

## 3. Project Maturity & Release Status

OmniSentinel is now **100% functionally complete and production hardened** across all 6 planned engineering phases (Phase 0 through Phase 6). The codebase is fully verified, typechecked, covered by automated integration test suites, containerized with Docker, and configured for zero-downtime deployment.
