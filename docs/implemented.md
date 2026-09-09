# OmniSentinel: Engineering Implementation Ledger

**System:** OmniSentinel (Autonomous Multi-Source Intent-First Tracker)  
**Maintained by:** Senior Development Team  
**Last Updated:** Phase 1 (Workspace, Data Contracts & Live Supabase Migration)

This document is the historical source of truth for all implemented code, architectural decisions, and system capabilities in the OmniSentinel repository. As features are built and verified, they are documented here in detail so that any engineer or recruiter can immediately see **what** was implemented, **how** it was engineered, and **why** specific technical choices were made.

---

## 1. High-Level Implementation Status

| Phase | Description | Status | Verification Gate |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Architecture, Design Documentation & Master Plan | **COMPLETED** | HLD, LLD, Description & Plan documented |
| **Phase 1** | Monorepo Setup, Database DDL (PostgreSQL) & Zod Contracts | **COMPLETED** | Build passes, DDL migrations executed on Supabase |
| **Phase 2** | Domain Resolvers & CLI Verification Harness | **COMPLETED** | All 4 resolvers verified via CLI commands |
| **Phase 3** | AI Intent Engine & BullMQ Queue Pipelines | **PENDING** | End-to-end background job loop verified in terminal |
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

## 3. What is Next to Implement

As outlined in [`plan.md`](file:///e:/OmniSentinel/docs/plan.md), the next immediate step is:
* **Phase 3: AI Intent Engine & BullMQ Asynchronous Queues**
  1. Google Gemini Flash Intent Classifier service (`POST /intent/parse` backend service).
  2. Redis connection manager (`ioredis`) for Upstash / local Redis.
  3. BullMQ queues: `monitor-scheduler-queue`, `execution-queue`, and `notification-queue`.
  4. BullMQ Scheduler worker (queries active monitors due for execution every 60s).
  5. BullMQ Execution worker with bounded concurrency ceiling: **`concurrency: 3`**.
  6. Auto-snooze state machine (transitions monitor to `TRIGGERED_SNOOZED` for 48h upon condition satisfaction).
  7. Brevo email client and Telegram Bot notification dispatchers.
