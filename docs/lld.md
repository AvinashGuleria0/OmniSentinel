# LLD.md: Low-Level Design Document
**System Name:** OmniSentinel (Autonomous Multi-Source Intent-First Tracker)  
**Version:** 1.0.0  
**Target Environment:** Node.js (v20+ LTS), TypeScript 5+, PostgreSQL 16+ (Supabase/Neon), Redis 7+ (BullMQ), Next.js 14+ App Router.

---

## 1. Directory & Module Structure

The project is structured as a modular TypeScript monolith (or clean npm workspace) separating the **Frontend Client**, the **API Core**, and the **Background Queue Worker** to allow independent scaling.

```text
omnisentinel/
├── apps/
│   ├── web/                           # Next.js 14+ Frontend
│   │   ├── app/
│   │   │   ├── (auth)/login/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx          # Monitors list & analytics
│   │   │   │   ├── monitors/new/page.tsx # Intent search & confirm
│   │   │   │   └── monitors/[id]/page.tsx # Detail & trend chart
│   │   │   └── api/                  # BFF / Webhook endpoints (Telegram, etc.)
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── intent-search-bar.tsx
│   │   │   ├── monitor-preview-modal.tsx
│   │   │   └── price-history-chart.tsx
│   │   └── lib/                      # Client-side helpers
│   │
│   └── server/                        # Node.js + Fastify API & Worker
│       ├── src/
│       │   ├── index.ts              # Server bootstrap
│       │   ├── config/               # Env & configuration schemas
│       │   ├── db/                   # Drizzle/Prisma schema & migrations
│       │   ├── api/
│       │   │   ├── routes/           # REST endpoints
│       │   │   └── middlewares/      # Auth & Rate limit
│       │   ├── queues/               # BullMQ setup
│       │   │   ├── connection.ts     # Redis ioredis client
│       │   │   ├── scheduler.queue.ts
│       │   │   ├── execution.queue.ts
│       │   │   └── notification.queue.ts
│       │   ├── workers/              # BullMQ worker consumers
│       │   │   ├── execution.worker.ts
│       │   │   └── notification.worker.ts
│       │   ├── services/
│       │   │   ├── intent/           # LLM Intent Router
│       │   │   ├── resolvers/        # Strategy pattern implementations
│       │   │   │   ├── base.resolver.ts
│       │   │   │   ├── ecommerce.resolver.ts
│       │   │   │   ├── stock.resolver.ts
│       │   │   │   ├── job.resolver.ts
│       │   │   │   └── generic-web.resolver.ts
│       │   │   ├── scraping/         # Playwright pool & browser manager
│       │   │   ├── storage/          # Cloudinary asset uploader
│       │   │   └── notifications/    # Telegram & Brevo clients
│       │   └── types/                # Shared TS types & Zod schemas
│       ├── Dockerfile
│       └── package.json
└── package.json
```

---

## 2. Database Schema (PostgreSQL DDL)

Strict relational schema using standard PostgreSQL conventions.

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enumerated Types
CREATE TYPE monitor_type AS ENUM ('ECOMMERCE', 'STOCK', 'JOB', 'GENERIC_WEB');
CREATE TYPE monitor_status AS ENUM ('ACTIVE', 'PAUSED', 'TRIGGERED_SNOOZED', 'BLOCKED');
CREATE TYPE check_status AS ENUM ('SUCCESS', 'FAILED', 'NO_CHANGE', 'CONDITION_MET');
CREATE TYPE notification_channel AS ENUM ('TELEGRAM', 'EMAIL', 'BOTH');

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    telegram_chat_id VARCHAR(100),
    preferred_channel notification_channel DEFAULT 'TELEGRAM',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Monitors Table
CREATE TABLE monitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type monitor_type NOT NULL,
    status monitor_status DEFAULT 'ACTIVE',
    
    -- Target Identifiers
    target_url TEXT,                      -- Nullable for API-based stocks/jobs
    target_symbol VARCHAR(50),           -- Stock symbol or Job Query ID
    
    -- Intent & Condition Criteria
    raw_prompt TEXT NOT NULL,             -- Original user request
    condition_operator VARCHAR(20) NOT NULL, -- 'LT', 'GT', 'EQUALS', 'CONTAINS', 'NEW_ENTRY'
    target_value NUMERIC(12, 2),          -- E.g., 2000.00 for price
    currency VARCHAR(10) DEFAULT 'INR',
    
    -- E-Commerce Specific Filters (JSONB for flexibility)
    -- Structure: { "include_coupons": true, "selected_banks": ["HDFC", "ICICI"] }
    filter_metadata JSONB DEFAULT '{}'::jsonb,

    -- Execution & Scheduling
    frequency_minutes INTEGER NOT NULL DEFAULT 60,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    snoozed_until TIMESTAMP WITH TIME ZONE,
    
    -- Change Detection State
    last_content_hash VARCHAR(64),        -- SHA-256 hash of extracted clean text
    last_known_value NUMERIC(12, 2),
    consecutive_failures INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Check Logs Table (For Historical Trend Charts & Auditing)
CREATE TABLE check_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status check_status NOT NULL,
    recorded_value NUMERIC(12, 2),
    metadata JSONB DEFAULT '{}'::jsonb,   -- Details: on-page coupons found, raw response, error trace
    screenshot_url TEXT,                  -- Cloudinary URL if condition was evaluated or met
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Seen Jobs Table (Deduplication engine for Job Sentinel)
CREATE TABLE seen_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    job_hash VARCHAR(64) NOT NULL,        -- SHA-256(company + title + location)
    job_title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    apply_url TEXT NOT NULL,
    first_detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Query Performance & Cron Lookups
CREATE INDEX idx_monitors_scheduler ON monitors (status, next_run_at) 
WHERE status = 'ACTIVE';

CREATE INDEX idx_check_logs_trend ON check_logs (monitor_id, created_at DESC);
CREATE INDEX idx_seen_jobs_dedup ON seen_jobs (user_id, job_hash);
```

---

## 3. Core TypeScript Interfaces & Contracts (Zod Schemas)

All inputs and inter-service payloads must be validated using Zod schemas.

```typescript
import { z } from 'zod';

// ==========================================
// Intent Classification Schemas
// ==========================================
export const IntentTypeEnum = z.enum(['ECOMMERCE', 'STOCK', 'JOB', 'GENERIC_WEB']);

export const IntentAnalysisSchema = z.object({
  type: IntentTypeEnum,
  title: z.string().describe("Concise display title for this monitor"),
  targetQuery: z.string().describe("Product name, stock symbol, job query, or search phrase"),
  conditionOperator: z.enum(['LT', 'GT', 'CONTAINS', 'NEW_ENTRY']),
  targetValue: z.number().nullable().describe("Target price, salary threshold, or null if checking existence"),
  currency: z.string().default('INR'),
  initialUrl: z.string().url().nullable().describe("Extracted or discovered URL if applicable"),
  confidence: z.number().min(0).max(1)
});

export type IntentAnalysis = z.infer<typeof IntentAnalysisSchema>;

// ==========================================
// E-Commerce Extraction Schemas
// ==========================================
export const EcommerceExtractionSchema = z.object({
  title: z.string(),
  basePrice: z.number(),
  currency: z.string().default('INR'),
  inStock: z.boolean(),
  universalCouponFound: z.boolean(),
  universalCouponDiscount: z.number().default(0),
  applicableBankOffers: z.array(z.object({
    bankName: z.string(),
    discountAmount: z.number(),
    description: z.string()
  })).default([]),
  effectivePrice: z.number().describe("Calculated final price based on active criteria")
});

export type EcommerceExtraction = z.infer<typeof EcommerceExtractionSchema>;

// ==========================================
// Job Extraction Schemas
// ==========================================
export const JobEntrySchema = z.object({
  externalId: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  isRemote: z.boolean(),
  stipendAmount: z.number().nullable(),
  applyUrl: z.string().url(),
  postedDate: z.string()
});

export type JobEntry = z.infer<typeof JobEntrySchema>;

// ==========================================
// Queue Job Payloads
// ==========================================
export const ExecutionJobPayloadSchema = z.object({
  monitorId: z.string().uuid(),
  type: IntentTypeEnum,
  targetUrl: z.string().nullable(),
  targetSymbol: z.string().nullable(),
  conditionOperator: z.string(),
  targetValue: z.number().nullable(),
  lastHash: z.string().nullable(),
  filterMetadata: z.record(z.any())
});

export type ExecutionJobPayload = z.infer<typeof ExecutionJobPayloadSchema>;

export const NotificationJobPayloadSchema = z.object({
  userId: z.string().uuid(),
  monitorId: z.string().uuid(),
  title: z.string(),
  currentValue: z.number().nullable(),
  targetValue: z.number().nullable(),
  message: z.string(),
  screenshotUrl: z.string().url().nullable(),
  actionUrl: z.string().url()
});

export type NotificationJobPayload = z.infer<typeof NotificationJobPayloadSchema>;
```

---

## 4. Subsystems & Strategy Pattern (The Resolvers)

Each data source implements a unified `IResolver` interface to encapsulate source-specific execution logic.

```text
           ┌────────────────────────┐
           │      <<interface>>     │
           │        IResolver       │
           └───────────┬────────────┘
                       │
       ┌───────────────┼───────────────┬────────────────┐
       ▼               ▼               ▼                ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐
│  Ecommerce  │ │    Stock    │ │     Job     │ │  GenericWeb   │
│  Resolver   │ │  Resolver   │ │  Resolver   │ │   Resolver    │
└─────────────┘ └─────────────┘ └─────────────┘ └───────────────┘
```

### Resolver Interface Definition

```typescript
export interface ResolutionResult {
  status: 'CONDITION_MET' | 'NO_CHANGE' | 'SUCCESS' | 'FAILED' | 'BLOCKED';
  currentValue: number | null;
  newHash: string | null;
  screenshotBuffer?: Buffer;
  extractedMetadata: Record<string, any>;
  notificationMessage?: string;
  actionUrl?: string;
}

export interface IResolver {
  resolve(payload: ExecutionJobPayload): Promise<ResolutionResult>;
}
```

### 1. `EcommerceResolver` Implementation Details
* **Engine:** Playwright with single-page reuse.
* **Extraction:** Injects a deterministic DOM cleaning script (stripping `script`, `style`, `svg`, ads), takes a localized screenshot of the price container, and feeds text to Gemini Flash using `EcommerceExtractionSchema`.
* **Calculation Algorithm:**
  $$\text{EffectivePrice} = \text{BasePrice} - \text{UniversalCoupon} - \max(\text{ActiveBankDiscount})$$
* **Condition Verification:** Evaluated in Node.js: `EffectivePrice <= targetValue`.

### 2. `StockResolver` Implementation Details
* **Engine:** Pure HTTP API via `yahoo-finance2`.
* **Execution Boundary:** Check system time against Indian Market Hours (Monday–Friday, 09:15 to 15:30 IST).
  * If outside market hours, the worker immediately returns `status: 'NO_CHANGE'` and schedules the next run for market open.
* **Zero Headless Scrapers:** No browser instances spawned, zero token cost.

### 3. `JobResolver` Implementation Details
* **Engine:** JSearch / RapidAPI HTTP REST client.
* **Deduplication Check:**
  1. Computes `jobHash = SHA256(company + title + location)`.
  2. Queries DB: `SELECT id FROM seen_jobs WHERE user_id = :userId AND job_hash = :jobHash`.
  3. Discards already seen jobs.
  4. Parses stipend/salary from the description.
  5. Inserts newly discovered jobs into `seen_jobs`.
  6. Returns `status: 'CONDITION_MET'` with the direct application link.

### 4. `GenericWebResolver` Implementation Details
* **Engine:** Playwright Headless Browser.
* **Hash Pipeline:**
  1. Navigates to `targetUrl`.
  2. Waits for network idle (`domcontentloaded`).
  3. Extracts inner text of `<body>`.
  4. Computes `currentHash = SHA256(cleanedText)`.
  5. If `currentHash === payload.lastHash`, returns `status: 'NO_CHANGE'`.
  6. If diff exists, passes diff to Gemini Flash with user condition: *"Did this update satisfy condition X?"*
  7. If verified, captures a full viewport screenshot.

---

## 5. Queue Architecture & Worker Specifications (BullMQ)

The architecture prevents server crashes and IP bans by strictly isolating queues and bounding concurrency.

```text
[Cron Dispatcher (Every 60s)] 
         │
         ▼
[monitor-scheduler-queue]
         │ (Pushes due tasks)
         ▼
[execution-queue] ────────────► [Worker Pool (Concurrency: 3)]
                                       │
                                       ├─ Playwright Instance (Locks resource)
                                       ├─ Evaluates Condition
                                       │
                                       ▼ (If Condition Met)
                                [notification-queue]
                                       │
                                       ▼
                             [Notification Worker]
                             ├── Telegram Bot API
                             └── Brevo Transactional Email
```

### Queue Configuration

```typescript
import { Queue, Worker, QueueOptions } from 'bullmq';
import { redisConnection } from './connection';

export const QUEUE_NAMES = {
  SCHEDULER: 'monitor-scheduler-queue',
  EXECUTION: 'execution-queue',
  NOTIFICATION: 'notification-queue'
} as const;

const defaultQueueConfig: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000 // 5s, 25s, 125s
    },
    removeOnComplete: true,
    removeOnFail: 100
  }
};

export const executionQueue = new Queue(QUEUE_NAMES.EXECUTION, defaultQueueConfig);
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, defaultQueueConfig);
```

### Worker Concurrency Limits

```typescript
// workers/execution.worker.ts
import { Worker } from 'bullmq';
import { QUEUE_NAMES } from '../queues/connection';
import { resolveMonitor } from '../services/resolver.factory';

export const executionWorker = new Worker(
  QUEUE_NAMES.EXECUTION,
  async (job) => {
    return await resolveMonitor(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 3, // Strict limit: Maximum 3 simultaneous Playwright browsers
    limiter: {
      max: 10,
      duration: 1000 // Global rate limit: 10 executions / sec
    }
  }
);
```

---

## 6. Detailed Logic Flowcharts & State Machines

### A. Monitor State Machine Transitions

```text
                 ┌───────────────┐
                 │    ACTIVE     │ ◄──────────────────────────────┐
                 └───────┬───────┘                                │
                         │                                        │
           Condition Met │                                        │
                         ▼                                        │ 48 Hours Elapsed /
                 ┌───────────────┐                                │ User Manual Reset
                 │   TRIGGERED   │                                │
                 └───────┬───────┘                                │
                         │                                        │
         Auto-Snooze fired│                                       │
                         ▼                                        │
                 ┌───────────────┐                                │
                 │TRIGGERED_SNOOZ│ ───────────────────────────────┘
                 └───────────────┘
                         ▲
                         │ Target site returns 403/Cloudflare Captcha
                 ┌───────┴───────┐
                 │    BLOCKED    │
                 └───────────────┘
```

### B. Execution Algorithm (Step-by-Step)

```text
Worker receives ExecutionJobPayload
  │
  ├──► Check Monitor Type
  │     ├── [STOCK] ──► Is Market Open?
  │     │                ├── NO  ──► Exit (Status: NO_CHANGE, re-queue for next open)
  │     │                └── YES ──► Fetch REST quote ──► Compare Value
  │     │
  │     ├── [JOB]   ──► Call JSearch API ──► Check Dedup (seen_jobs table)
  │     │                ├── Duplicate ──► Exit
  │     │                └── New Entry ──► Insert DB ──► Flag Condition Met
  │     │
  │     └── [ECOMMERCE / WEB]
  │           ├── Acquire Playwright Browser Context
  │           ├── Navigate with 15s timeout
  │           ├── Check HTTP Status
  │           │    ├── 403 / Captcha ──► Mark Monitor BLOCKED ──► Exit
  │           │    └── 200 OK
  │           ├── Extract Clean Text & Compute SHA-256
  │           ├── Compare Hash with payload.lastHash
  │           │    ├── Match ──► Exit (Status: NO_CHANGE, 0 LLM Cost)
  │           │    └── Diff  ──► Extract structured fields via Gemini Flash
  │           │                  ├── Take Component/Viewport Screenshot
  │           │                  └── Run Deterministic Math (Base - Coupon - Bank)
  │           └── Release Browser Context
  │
  ├──► Condition Met?
  │     ├── NO  ──► Update next_run_at = NOW() + frequency ──► Log to check_logs
  │     └── YES ──►
  │           ├── Upload Screenshot to Cloudinary
  │           ├── Set Monitor Status: TRIGGERED_SNOOZED, snoozed_until = NOW() + 48 Hours
  │           ├── Push to notification-queue
  │           └── Log to check_logs (Status: CONDITION_MET)
  └──► Done
```

---

## 7. REST API Endpoint Specifications

All endpoints prefix: `/api/v1`

### 1. Intent Parse & Discovery (Preview Phase)
* **Route:** `POST /intent/parse`
* **Purpose:** Takes raw user prompt and returns classified type, parsed values, and preview candidates without saving.
* **Request Body:**
  ```json
  {
    "prompt": "Alert me when Nike Air Max drops below 3000 on Amazon with my HDFC card"
  }
  ```
* **Response Body (200 OK):**
  ```json
  {
    "analysis": {
      "type": "ECOMMERCE",
      "title": "Nike Air Max Price Watch",
      "targetQuery": "Nike Air Max",
      "conditionOperator": "LT",
      "targetValue": 3000,
      "currency": "INR",
      "filterMetadata": {
        "include_coupons": true,
        "selected_banks": ["HDFC"]
      }
    },
    "previewResults": [
      {
        "title": "Nike Air Max SYSTM Men Shoes - Black (Size 9)",
        "currentPrice": 4295,
        "thumbnail": "https://m.media-amazon.com/images/I/...",
        "source": "Amazon",
        "url": "https://amazon.in/dp/B0..."
      }
    ]
  }
  ```

### 2. Create Monitor
* **Route:** `POST /monitors`
* **Request Body:**
  ```json
  {
    "title": "Nike Air Max Price Watch",
    "type": "ECOMMERCE",
    "targetUrl": "https://amazon.in/dp/B0...",
    "rawPrompt": "Alert me when Nike Air Max drops below 3000",
    "conditionOperator": "LT",
    "targetValue": 3000,
    "currency": "INR",
    "filterMetadata": {
      "include_coupons": true,
      "selected_banks": ["HDFC"]
    },
    "frequencyMinutes": 60
  }
  ```
* **Response Body (201 Created):**
  ```json
  {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "status": "ACTIVE",
    "nextRunAt": "2026-09-08T08:00:00.000Z"
  }
  ```

### 3. Get Monitor History (For Trend Chart)
* **Route:** `GET /monitors/:id/history`
* **Response Body (200 OK):**
  ```json
  {
    "monitorId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "history": [
      { "timestamp": "2026-09-07T10:00:00.000Z", "value": 4295.00 },
      { "timestamp": "2026-09-07T16:00:00.000Z", "value": 3999.00 },
      { "timestamp": "2026-09-08T02:00:00.000Z", "value": 2899.00 }
    ]
  }
  ```

---

## 8. Anti-Abuse, Mock Mode & Security Specifications

### A. Development Mocking Switch
To avoid burning API tokens, triggering IP bans, or spamming your personal Telegram account during development, define an explicit `MOCK_MODE` behavior in code:

```typescript
// config/env.ts
export const CONFIG = {
  MOCK_MODE: process.env.MOCK_MODE === 'true',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  BREVO_API_KEY: process.env.BREVO_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
};

// In Scraper Service:
if (CONFIG.MOCK_MODE) {
  logger.info("[MOCK] Bypassing real browser. Returning static HTML fixture.");
  return {
    rawText: "Nike Air Max 90 Listed Price: 2,799 INR. Apply 500 coupon.",
    screenshotBuffer: Buffer.from("mock_image_bytes")
  };
}
```

### B. Playwright Stealth & Headless Tuning
When running in production:
1. Block unnecessary media to save network bandwidth and speed up runs:
   ```typescript
   await page.route('**/*', (route) => {
     const resourceType = route.request().resourceType();
     if (['media', 'font'].includes(resourceType)) {
       route.abort();
     } else {
       route.continue();
     }
   });
   ```
2. Inject legitimate user-agent headers:
   ```typescript
   userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
   ```

---

## 9. Implementation Roadmap (Milestones for AI Agent)

When prompting your AI agent in AntiGravity IDE, complete development in these strict phases:

* **Phase 1: DB & Contracts**
  * Initialize monorepo.
  * Run PostgreSQL schema migration using Drizzle or Prisma.
  * Implement shared Zod schemas.
* **Phase 2: Intent Engine & Resolvers**
  * Implement Gemini Intent Classifier with structured outputs.
  * Implement `StockResolver` (Yahoo Finance) and verify market hour checks.
  * Implement `EcommerceResolver` and `GenericWebResolver` with Playwright.
* **Phase 3: BullMQ & Queue Pipelines**
  * Connect Redis client.
  * Implement Scheduler cron (scanning due monitors every 60 seconds).
  * Build the Execution Worker with concurrency limit = 3.
* **Phase 4: Notifications & Dashboard**
  * Wire up Telegram Bot API and Brevo transactional email templates.
  * Build Next.js Dashboard: Search bar, Preview confirmation modal, Active monitors table, Recharts price trend line.