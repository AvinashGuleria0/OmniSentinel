# OmniSentinel: Engineering Master Plan & Roadmap

**System:** OmniSentinel (Autonomous Multi-Source Intent-First Tracker)  
**Author:** Senior Founding Engineer  
**Status:** DRAFT / PENDING REVIEW  
**Architecture:** Distributed Event-Driven Micro-Monolith (Next.js 14+ / Fastify Node.js / PostgreSQL / Redis BullMQ / Playwright / Gemini Flash)

---

## 1. Architectural Strategy & Engineering Decisions

As a senior startup engineer building OmniSentinel for production resilience and portfolio impact, several critical architectural decisions govern this plan:

### 1.1 ORM Selection: Drizzle ORM over Prisma
* **Decision:** We use **Drizzle ORM** with `pg` / `@neondatabase/serverless`.
* **Rationale:** Prisma relies on a 40MB+ Rust binary engine that introduces cold starts, connection overhead, and complex cross-compilation in Alpine/Debian Docker containers. Drizzle provides zero-overhead, pure TypeScript type-safety, direct SQL control, and effortless schema migrations matching our exact PostgreSQL DDL.

### 1.2 Monorepo Layout & Execution Topology
* **Structure:** `npm` workspaces (native, zero extra package manager friction):
  * `apps/server`: Fastify REST API, Queue Scheduler, Execution Worker Pool, Resolvers, CLI Test Runner.
  * `apps/web`: Next.js 14 App Router, shadcn/ui, Tailwind CSS, Recharts.
  * `packages/shared`: Shared TypeScript types, Zod schemas, domain constants.
* **Dual-Mode Backend Execution:**
  * **Development Mode:** A single script (`npm run dev`) boots the Fastify API, BullMQ Scheduler, and BullMQ Execution Worker concurrently for friction-free local work.
  * **CLI Testing Mode:** Standalone CLI harnesses (`npm run cli:test`) allow testing any resolver, intent parser, or worker without starting the HTTP server or frontend.
  * **Production Mode:** The API and Worker can be spun up as separate container processes to enforce worker isolation.

### 1.3 Strict "Backend & CLI First" Verification Gate
* No frontend code will be written until all 4 resolvers (`Ecommerce`, `Stock`, `Job`, `GenericWeb`), the Gemini intent classifier, and the BullMQ queues pass automated CLI integration tests.
* The system must operate 100% reliably in headless CLI mode first.

### 1.4 Mock-First Architecture (`MOCK_MODE=true`)
* All external adapters (Playwright browser, Gemini Flash LLM, Telegram Bot, Brevo Email, Yahoo Finance) must feature pluggable mock implementations so the entire system can be developed and tested immediately without third-party API dependencies or spending credits.

---

## 2. Phased Implementation Roadmap & Checklists

```text
┌───────────────────────────┐
│ Phase 1: Workspace & DDL  │ ──► Monorepo, DB Schema, Zod Contracts, Config & Logger
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│ Phase 2: Resolvers & CLI  │ ──► Stock, Ecommerce, Job, Generic Resolvers + CLI Runner
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│ Phase 3: AI & Queue Core  │ ──► Gemini Intent Classifier, BullMQ Workers, Deduplication
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│ Phase 4: Fastify REST API │ ──► Endpoints (/intent/parse, /monitors, /history), Auth
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│ Phase 5: Next.js Frontend │ ──► Universal Search Bar, Preview Modal, History Dashboard
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│ Phase 6: E2E & Deploy     │ ──► Live Telegram/Brevo, Docker, Production Hardening
└───────────────────────────┘
```

---

### Phase 1: Monorepo Setup, Database Engine & Data Contracts

**Goal:** Establish the rock-solid foundation: workspace configuration, database migrations, shared validation schemas, and environment management.

- [x] **1.1 Monorepo Workspace Configuration**
  - [x] Root `package.json` with npm workspaces (`apps/*`, `packages/*`).
  - [x] Root `tsconfig.base.json` with strict type checking and path aliases.
  - [x] Shared package `@omnisentinel/shared` containing Zod schemas and TypeScript interfaces (`IntentAnalysisSchema`, `EcommerceExtractionSchema`, `ExecutionJobPayloadSchema`, etc.).
  - [x] Environment loader & validator using Zod (`config/env.ts`) with `MOCK_MODE` toggle.
- [x] **1.2 Database Engine & Drizzle ORM**
  - [x] Configure Drizzle ORM connection for PostgreSQL (Supabase / local Postgres).
  - [x] Define schemas for `users`, `monitors`, `check_logs`, and `seen_jobs` with proper foreign keys, ENUM types, and indexes.
  - [x] Generate and test baseline SQL migration.
  - [x] Create seed script for testing users and dummy monitors.
- [x] **1.3 Structured Logging & Error Handling Framework**
  - [x] Setup Pino logger with pretty-printing for local development.
  - [x] Setup custom ApplicationError classes (`NotFoundError`, `ValidationError`, `ScrapingBlockedError`).

**Acceptance Criteria for Phase 1:**
- `npm run build` succeeds across all workspaces.
- Database migration script runs against Postgres and creates all 4 tables, enums, and indexes without errors.

---

### Phase 2: Domain Resolvers & CLI Verification Harness

**Goal:** Build and verify all 4 data resolvers in isolation using a dedicated terminal CLI tool before touching queues or servers.

- [x] **2.1 Base Resolver Contract**
  - [x] Define `IResolver` interface and `ResolutionResult` contract.
  - [x] Implement `ResolverFactory` for routing payloads based on `monitor_type`.
- [x] **2.2 Financial & Stock Resolver (`StockResolver`)**
  - [x] Integration with `yahoo-finance2` API for ticker lookups (e.g. `AIRTEL.NS`, `AAPL`).
  - [x] Implement Indian & US Market Hours evaluation logic (checks if exchange is currently open; skips cleanly if closed).
  - [x] Mock adapter returning fixed ticker prices when `MOCK_MODE=true`.
- [x] **2.3 E-Commerce Deals Resolver (`EcommerceResolver`)**
  - [x] Playwright scraper setup with resource-blocking (aborts fonts, images, stylesheets).
  - [x] DOM sanitization: strip `<script>`, `<style>`, `<svg>`, iframes, and extract clean product metadata.
  - [x] Implement multi-tier discount math: $\text{EffectivePrice} = \text{BasePrice} - \text{Coupon} - \max(\text{SelectedBankDiscount})$.
  - [x] Element/viewport screenshot capture to Buffer.
  - [x] Mock adapter with pre-recorded Amazon & Flipkart HTML fixtures.
- [x] **2.4 Career & Internship Resolver (`JobResolver`)**
  - [x] JSearch / RapidAPI HTTP client integration.
  - [x] Regex and heuristic stipend/salary extractor.
  - [x] Cryptographic hash deduplication logic: `SHA-256(company + title + location)` verified against `seen_jobs`.
- [x] **2.5 Generic Web Announcement Resolver (`GenericWebResolver`)**
  - [x] Clean text extraction and SHA-256 hash calculation.
  - [x] Change detection logic: compare with `last_content_hash`.
- [x] **2.6 Interactive CLI Test Harness (`apps/server/src/cli/index.ts`)**
  - [x] CLI command to test any resolver with custom inputs from the terminal.
  - [x] Formatted terminal output displaying values, hash diffs, screenshots saved to disk, and execution timing.

**Acceptance Criteria for Phase 2:**
- Running `npm run cli:test stock AAPL` outputs current price and market status.
- Running `npm run cli:test ecommerce <mock_or_real_url>` outputs base price, detected coupons, effective price, and saves a verification screenshot.
- Running `npm run cli:test job "MERN intern"` returns structured openings and confirms deduplication hashes.

---

### Phase 3: AI Intent Engine & BullMQ Asynchronous Queues

**Goal:** Implement the AI classification layer, Redis connection, distributed task scheduler, and worker pool with bounded concurrency.

- [x] **3.1 Gemini Flash Intent Classifier Service**
  - [x] Google GenAI SDK integration with Gemini Flash model.
  - [x] Structured prompt enforcing `IntentAnalysisSchema` with Zod validation.
  - [x] Source discovery helper (maps product query to Amazon/Flipkart search URLs or stock ticker).
  - [x] Mock LLM fallback providing instant deterministic JSON fixtures when `MOCK_MODE=true`.
- [x] **3.2 Redis & BullMQ Infrastructure**
  - [x] Redis connection manager (`ioredis`) supporting local Redis and Upstash TLS.
  - [x] Queue definitions:
    - `monitor-scheduler-queue` (Cron / periodic polling)
    - `execution-queue` (Resolver execution jobs)
    - `notification-queue` (Alert dispatch jobs)
- [x] **3.3 BullMQ Scheduler Worker**
  - [x] Cron job running every 60s querying monitors where `status = 'ACTIVE' AND next_run_at <= NOW()`.
  - [x] Batches due tasks and enqueues them into `execution-queue`.
- [x] **3.4 BullMQ Execution Worker**
  - [x] Strict concurrency setting: `concurrency: 3`.
  - [x] Executes `resolveMonitor(job.data)`.
  - [x] Auto-snooze state machine: if condition met, set `status = 'TRIGGERED_SNOOZED'`, `snoozed_until = NOW() + 48h`.
  - [x] Inserts record into `check_logs`.
  - [x] Pushes to `notification-queue` if condition is satisfied.
- [x] **3.5 Notification Worker & Dispatchers**
  - [x] Cloudinary uploader service for visual screenshot buffers.
  - [x] Telegram Bot API client (sends formatted markdown + inline screenshot photo).
  - [x] Brevo email client with modern HTML email template.
  - [x] Mock dispatcher that prints formatted alerts to stdout in development.

**Acceptance Criteria for Phase 3:**
- A full background loop executes: monitor is scheduled -> worker processes it -> log written to DB -> auto-snooze kicks in -> notification dispatched.
- Terminal CLI worker command (`npm run worker:dev`) runs smoothly and shows clear job logs.

---

### Phase 4: Fastify API Gateway & Backend Endpoints

**Goal:** Expose the backend via Fastify with high throughput, CORS, authentication middleware, and input validation.

- [x] **4.1 Fastify Server Bootstrap**
  - [x] Fastify instance with `@fastify/cors`, `@fastify/helmet`, and `@fastify/sensible`.
  - [x] Global error handler and request ID correlation.
- [x] **4.2 REST Endpoints Implementation**
  - [x] `POST /api/v1/intent/parse`: Parses user prompt, returns intent analysis and preview cards without saving.
  - [x] `POST /api/v1/monitors`: Creates monitor, sets `next_run_at = NOW()`, immediately enqueues first check.
  - [x] `GET /api/v1/monitors`: Lists user monitors with status badges, last values, and failure counters.
  - [x] `GET /api/v1/monitors/:id`: Fetches single monitor details.
  - [x] `PATCH /api/v1/monitors/:id`: Update filters, threshold, or re-arm snoozed monitor.
  - [x] `DELETE /api/v1/monitors/:id`: Soft delete or cascade delete monitor and logs.
  - [x] `GET /api/v1/monitors/:id/history`: Returns historical check log data points for Recharts.
- [x] **4.3 API Integration Tests**
  - [x] Fastify `inject()` automated integration tests validating all endpoints, status codes, and Zod schemas.

**Acceptance Criteria for Phase 4:**
- All API routes pass automated HTTP injection tests with 200/201 responses and proper validation error codes (400, 404).

---

### Phase 5: Next.js 14+ Frontend Dashboard

**Goal:** Build a stunning, responsive, SaaS-grade UI that wows users at first glance with smooth animations, dark mode, and zero clutter.

- [x] **5.1 Frontend Design System & Scaffold**
  - [x] Next.js 14 App Router project setup with Tailwind CSS 3 and custom glassmorphic design tokens.
  - [x] Premium dark mode aesthetic: zinc/slate base, ambient cyan/blue/violet glows, glassmorphic cards with hover lift.
  - [x] Sticky header with live API status beacon, system telemetry (total/active/snoozed monitors), and `⌘K` shortcut button.
- [x] **5.2 Universal Intent Search & Interactive Preview Modal**
  - [x] Prominent `UniversalSearchBar` with `Ctrl+K` / `Cmd+K` keyboard shortcut, animated rotating placeholder suggestions, and preset domain chips.
  - [x] `IntentPreviewModal` with confidence score badge, 3 candidate preview cards with source logos and prices, and "Deploy Sentinel" CTA.
  - [x] Interactive filter controls: bank card checkboxes (HDFC, ICICI, SBI, Axis), auto-apply coupon toggle, and 5-tier frequency selector.
- [x] **5.3 Active Monitors Grid & Management**
  - [x] `MonitorCard` showing animated live status badges (`ACTIVE` pulse, `TRIGGERED_SNOOZED` amber, `PAUSED`, `BLOCKED`).
  - [x] Per-card actions toolbar: Re-arm, Pause/Resume, Analytics Drawer, Delete; with snooze countdown display.
  - [x] `MonitorsGrid` with domain filter tabs (All / Stocks / E-Commerce / Jobs / Web Scrapers) and real-time search filter.
- [x] **5.4 Analytics & Historical Price Trend View**
  - [x] `MonitorAnalyticsDrawer` slide-over panel with metrics overview and chronological execution audit log.
  - [x] Interactive Recharts `LineChart` with cyan trend line, amber target reference line, and custom styled tooltip.
  - [x] Visual proof screenshot section: Cloudinary CDN image thumbnail with fullscreen lightbox on click.

**Acceptance Criteria for Phase 5:**
- Complete user flow works seamlessly in browser: type prompt -> see preview -> confirm monitor -> view monitor in dashboard -> trigger test run -> view updated chart and screenshot.

---

### Phase 6: End-to-End Hardening, Deployment & CI/CD

**Goal:** Connect live production services, containerize the stack, and prepare for one-click deployment.

- [ ] **6.1 Live Production Integrations**
  - [ ] Verify live Gemini Flash API key and live Google Search / Serper / JSearch API keys.
  - [ ] Verify live Telegram Bot webhook/chat dispatch.
  - [ ] Verify live Brevo transactional email delivery.
  - [ ] Verify live Cloudinary media bucket upload.
- [ ] **6.2 Dockerization & Worker Isolation**
  - [ ] Multi-stage `Dockerfile` for backend including Chromium and Debian Playwright system dependencies.
  - [ ] `docker-compose.yml` for local full-stack orchestration (Postgres, Redis, API, Worker).
- [ ] **6.3 Deployment Documentation & Verification**
  - [ ] Vercel deployment guide for Next.js frontend.
  - [ ] Railway / Render configuration for Fastify API and BullMQ worker.
  - [ ] Supabase PostgreSQL and Upstash Redis production connection guides.

---

## 3. Immediate Questions & Senior Engineer Recommendations for the User

Before we execute Step 1, here are **3 strategic engineering points** for us to align on:

1. **Package Manager Preference**:
   * *Recommendation:* Use standard `npm` workspaces. It is pre-installed with Node.js on your Windows machine, avoids global package manager mismatches, and works cleanly with Docker.
   * *Question:* Are you comfortable using `npm` workspaces, or do you strongly prefer `pnpm`?

2. **Local Services Setup vs Cloud Free Tiers**:
   * For the database and Redis:
     - **Option A (Zero local setup / Cloud managed):** Use free cloud tiers (Supabase for PostgreSQL + Upstash for Redis). Requires only setting connection strings in `.env`.
     - **Option B (Local containers):** Use local Docker Desktop / local Redis and PostgreSQL on your Windows machine.
     - **Option C (Mock-first):** We start with `MOCK_MODE=true` and an SQLite or in-memory adapter/local Postgres for initial CLI verification.
   * *Recommendation:* We provide seamless support for both. Setting up with Supabase + Upstash is the fastest path without installing heavy local database servers on Windows.

3. **Backend Structure**:
   * *Recommendation:* We keep the API and Worker code in `apps/server` with clean modular separation (`src/api`, `src/workers`, `src/resolvers`, `src/cli`). A single script `npm run dev` boots both during development, and a standalone CLI tool `npm run cli:test` lets us test resolvers immediately.

---

*This plan is ready for execution as soon as we align on the initial setup.*
