# HLD.md: High-Level Design Document
**System Name:** OmniSentinel (Autonomous Multi-Source Intent-First Tracker)  
**Document Version:** 1.0.0  
**Target Architecture:** Distributed Event-Driven Micro-Monolith (Next.js + Node.js Worker Pool + BullMQ/Redis + PostgreSQL)

---

## 1. Executive Summary & System Objectives

OmniSentinel is an autonomous, intent-driven monitoring system designed to bridge the gap between human requests and real-world web state changes. Traditional web monitors force users to copy-paste URLs and configure rigid CSS selectors. OmniSentinel operates on **Natural Language Intent**: users state *what* they care about (products, stocks, job postings, public notices), and the system automatically determines the target source, runs cost-optimized polling cycles, extracts structured metrics via an LLM, and delivers verified alerts accompanied by visual proof.

### 1.1 Key Functional Requirements
* **Universal Search Input:** Single input bar accepting open-ended queries (e.g., *"Nike Pegasus under 3000 on Amazon with my HDFC card"*, *"Airtel stock below 1000"*, *"Remote MERN intern with 25k stipend"*).
* **Intent Routing & Discovery:** Classifies user prompts into distinct domains (`ECOMMERCE`, `STOCK`, `JOB`, `GENERIC_WEB`) and auto-resolves canonical URLs or ticker symbols.
* **Search & Confirm UX:** Previews matches before persistence to guarantee 100% target accuracy without requiring manual URL copy-pasting.
* **Cost-Optimized Change Detection:** Employs a two-tier verification model (SHA-256 DOM hashing + LLM schema extraction) to eliminate 90%+ of redundant AI token costs.
* **Zero-Hallucination Evaluation:** Math and logical operators (`<`, `>`, `==`) are strictly executed by deterministic runtime code, never by the LLM.
* **Multi-Channel Alert Dispatch:** Instant, actionable alerts delivered via Telegram Bot (with image preview) and transactional Email (Brevo).
* **Anti-Spam & Auto-Snooze:** Prevents alert fatigue by automatically transitioning triggered monitors into a 48-hour snooze state.

### 1.2 Non-Functional Requirements (NFRs)
* **Scalability:** Worker pool horizontally decoupled from the web layer via Redis queues; headless browser concurrency strictly bounded to protect CPU/RAM.
* **Reliability & Fault Tolerance:** Automatic retry mechanism with exponential backoff (5s, 25s, 125s) for flaky network requests; self-healing state transitions (`BLOCKED`, `PAUSED`).
* **Cost Efficiency:** Offloads high-frequency checks (stocks) to lightweight REST APIs, skipping headless browsers and LLM calls entirely.
* **Data Security & Privacy:** Encrypted credentials, strict database row-level security (RLS), and zero storage of user financial credentials (bank filters operate purely as on-page discount matchers).

---

## 2. System Architecture Diagram

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT LAYER                                      │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │                 Next.js 14+ Dashboard (Vercel Edge / Node)               │   │
│   │   [ Universal Search ] ── [ Preview Modal ] ── [ Historical Analytics ]  │   │
│   └──────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ HTTPS / REST (JWT Auth)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY & CORE API                              │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │                     Fastify / Node.js API Server                         │   │
│   │   ├── Auth Middleware (Supabase JWT / Session)                           │   │
│   │   ├── Intent Classifier Service (Gemini Flash with Structured Output)    │   │
│   │   ├── Discovery Service (E-Commerce Search, JSearch, Serper API)         │   │
│   │   └── CRUD Controller (Monitors, History, User Preferences)              │   │
│   └────────────────────────┬────────────────────────────────┬────────────────┘   │
└────────────────────────────┼────────────────────────────────┼────────────────────┘
                             │                                │
                             ▼                                ▼
            ┌──────────────────────────────────┐   ┌───────────────────────────────┐
            │       STATE STORE (Database)     │   │      MESSAGE BROKER (Redis)   │
            │   PostgreSQL (Supabase / Neon)   │   │         Upstash / Redis 7+    │
            │   - users                        │   │   - monitor-scheduler-queue   │
            │   - monitors                     │   │   - execution-queue           │
            │   - check_logs                   │   │   - notification-queue        │
            │   - seen_jobs                    │   └──────────────┬────────────────┘
            └──────────────────────────────────┘                  │
                                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         ASYNCHRONOUS WORKER POOL                                 │
│                                                                                  │
│   ┌───────────────────────────────┐          ┌───────────────────────────────┐   │
│   │      Execution Workers        │          │     Notification Workers      │   │
│   │     (Concurrency Limit: 3)    │          │                               │   │
│   │  ├── Playwright Browser Pool  │          │  ├── Telegram Bot Dispatcher  │   │
│   │  ├── Financial REST Resolver  │          │  └── Brevo Email Dispatcher   │   │
│   │  ├── Job Aggregator Resolver  │          └──────────────┬────────────────┘   │
│   │  └── Cloudinary Asset Upload  │                         │                    │
│   └───────────────┬───────────────┘                         │                    │
└───────────────────┼─────────────────────────────────────────┼────────────────────┘
                    │                                         │
                    ▼                                         ▼
┌──────────────────────────────────────┐   ┌───────────────────────────────────────┐
│          EXTERNAL SERVICES           │   │             END CONSUMERS             │
│  - Gemini Flash (Structured Extr.)   │   │  - User Telegram Account (Instant)    │
│  - Yahoo Finance API (`yfinance2`)   │   │  - User Email Inbox (HTML Report)     │
│  - RapidAPI JSearch / Google Jobs    │   │                                       │
│  - Cloudinary CDN (Image Hosting)    │   │                                       │
└──────────────────────────────────────┘   └───────────────────────────────────────┘
```

---

## 3. High-Level Subsystems & Responsibilities

| Subsystem | Primary Tech | Architectural Responsibility |
| :--- | :--- | :--- |
| **Web Client** | Next.js, Tailwind, shadcn/ui, Recharts | User onboarding, intent query input, interactive match confirmation, responsive analytics dashboard. |
| **API Server** | Node.js, Fastify, Zod | Handles authenticated client requests, intent classification, source discovery, and database mutations. |
| **Scheduler Engine** | BullMQ Repeatable Jobs / Cron | Periodically polls PostgreSQL (`every 60s`) for active monitors where `next_run_at <= NOW()` and fans tasks into Redis. |
| **Execution Worker Pool** | Node.js, Playwright, BullMQ | Consumes execution jobs from Redis; isolates web scraping concurrency; executes domain-specific resolvers; uploads visual screenshots. |
| **Verification Pipeline** | SHA-256 Engine + Gemini Flash | Pre-filters non-diffed content; parses messy DOM/text into strictly typed JSON entities; validates condition operators. |
| **Notification Engine** | Telegram Bot API, Brevo | Asynchronously renders rich HTML templates and dispatches Telegram photo messages with deep-links. |

---

## 4. End-to-End Execution Lifecycles

### Flow A: Creation & Search-and-Confirm Lifecycle
This flow eliminates the friction of manual URL copy-pasting while preventing mismatched products.

```text
[User]                 [Client]               [API Gateway]            [Gemini Flash]       [Discovery APIs]
  │                        │                        │                         │                    │
  │── 1. Types Prompt ────►│                        │                         │                    │
  │   ("Nike Air Max...")  │── 2. POST /intent/parse│                         │                    │
  │                        │───────────────────────►│                         │                    │
  │                        │                        │── 3. Classify Intent ──►│                    │
  │                        │                        │◄── 4. Structured JSON ──│                    │
  │                        │                        │   (Type: ECOMMERCE)     │                    │
  │                        │                        │                                              │
  │                        │                        │── 5. Query Search Engine (Amazon/Flipkart) ─►│
  │                        │                        │◄── 6. Return Top 3 Matching Product Cards ───│
  │                        │◄── 7. Render Previews ─│
  │◄── 8. Displays Cards ──│
  │
  │── 9. Selects Card & Toggles Coupons (HDFC) ────►│
  │                        │── 10. POST /monitors ─►│
  │                        │                        │── 11. Save Monitor to PostgreSQL (Status: ACTIVE)
  │                        │                        │── 12. Enqueue First Immediate Check in BullMQ
  │                        │◄── 13. 201 Created ────│
```

---

### Flow B: Scheduled Polling & Two-Tier Verification Lifecycle
This flow guarantees minimal server resource consumption and zero token waste on static web pages.

```text
[BullMQ Scheduler]       [Execution Queue]      [Execution Worker]        [Target Site]        [Gemini Flash]
        │                        │                       │                      │                     │
  (Every 60s)                    │                       │                      │                     │
        │── 1. Query Due Mon. ──►│                       │                      │                     │
        │── 2. Push Batch Tasks ─┼──────────────────────►│                      │                     │
                                 │                       │── 3. Check Type      │                     │
                                                         │                      │                     │
         ┌───────────────────────────────────────────────┴──────────────────────┤                     │
         │ [CASE: STOCK]                                                        │                     │
         │ ├── Check Market Hours (IST). If closed: Reschedule & Exit           │                     │
         │ └── Fetch via Yahoo Finance API (50ms) ──► Compare Value             │                     │
         │                                                                      │                     │
         │ [CASE: E-COMMERCE / GENERIC WEB]                                     │                     │
         │ ├── Launch Playwright from Pool                                      │                     │
         │ ├── Navigate to Target URL ─────────────────────────────────────────►│                     │
         │ ├── Strip <script>, <style>, <svg> ──► Compute SHA-256 Hash          │                     │
         │ │                                                                    │                     │
         │ ├── Hash === last_content_hash?                                      │                     │
         │ │    ├── YES: Log NO_CHANGE, Release Browser, Exit. (0 Token Cost)   │                     │
         │ │    └── NO:  Extract Clean Text Snippet                             │                     │
         │ │              │                                                     │                     │
         │ │              ├── Pass Text to LLM with Zod Schema ─────────────────┼────────────────────►│
         │ │              │◄── Return Extracted Numbers (Base, Coupon, Bank) ───┼─────────────────────│
         │ │              ├── Take Viewport/Element Screenshot                  │                     │
         │ │              └── Calculate: EffectivePrice = Base - Coupon - Bank  │                     │
         │ └────────────────────────────────────────────────────────────────────┘                     │
```

---

### Flow C: Condition Trigger, Auto-Snooze & Notification Lifecycle
When an event condition is satisfied, the system captures visual evidence and notifies the user without causing notification spam.

```text
[Execution Worker]          [Cloudinary]         [PostgreSQL]        [Notification Queue]     [Telegram / Brevo]
        │                         │                    │                       │                       │
 (Condition Met!)                 │                    │                       │                       │
        │── 1. Upload Screenshot ─►│                    │                       │                       │
        │◄── 2. Public CDN URL ───│                    │                       │                       │
        │                                              │                       │                       │
        │── 3. Mutate Monitor State ──────────────────►│                       │                       │
        │      - status = 'TRIGGERED_SNOOZED'          │                       │                       │
        │      - snoozed_until = NOW() + 48h           │                       │                       │
        │      - Insert log into check_logs            │                       │                       │
        │                                              │                       │                       │
        │── 4. Enqueue Notification Job ───────────────┼──────────────────────►│                       │
                                                       │                       │── 5. Consume Task ───►│
                                                       │                       │                       │
                                                       │                       │── 6. Send Telegram ──► User Phone
                                                       │                       │      (Photo + Text)
                                                       │                       │
                                                       │                       │── 7. Send Email ─────► User Inbox
                                                       │                       │      (Brevo HTML)
```

---

## 5. Domain-Specific Resolver Architecture

The system uses the **Strategy Pattern** via a central `IResolver` contract. This keeps domain complexities isolated from the main queue processor.

```text
                          ┌───────────────────────────┐
                          │   ExecutionJobPayload     │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │     ResolverFactory       │
                          └─────────────┬─────────────┘
                                        │
         ┌──────────────────┬───────────┴───────────┬──────────────────┐
         ▼                  ▼                       ▼                  ▼
┌─────────────────┐┌─────────────────┐    ┌──────────────────┐┌─────────────────┐
│EcommerceResolver││  StockResolver  │    │   JobResolver    ││GenericWebResolv │
├─────────────────┤├─────────────────┤    ├──────────────────┤├─────────────────┤
│- Amazon/Flipkart││- NSE/BSE Tickers│    │- JSearch API     ││- Govt. Notices  │
│- Playwright Scrp││- yfinance2 REST │    │- Dedup seen_jobs ││- DU Cutoff list │
│- Universal Coup ││- Market-Hour    │    │- Stipend Filter  ││- Hash Diffing   │
│- Bank Card Calc ││  Throttler      │    │- Direct Apply URL││- Full Screenshot│
└─────────────────┘└─────────────────┘    └──────────────────┘└─────────────────┘
```

### 5.1 Resolver Specialization Matrix

| Domain | Protocol Used | Primary Data Source | Headless Browser Used? | AI Token Invocations | Cost / Run |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`ECOMMERCE`** | Headless Browser | Direct Product Page | **Yes** (Playwright) | Only on Hash Change | Low ($\sim \$0.0001$) |
| **`STOCK`** | REST HTTP | Yahoo Finance / AlphaVantage | **No** | **Never** | Zero ($\$0.00$) |
| **`JOB`** | REST HTTP | JSearch Aggregator API | **No** | Only if salary hidden | Negligible |
| **`GENERIC_WEB`** | Headless Browser | Target Announcement URL | **Yes** (Playwright) | Only on Hash Change | Low ($\sim \$0.0001$) |

---

## 6. Resilience, Anti-Bot & Scalability Strategies

### 6.1 Bounded Worker Concurrency (Preventing Resource Exhaustion)
Headless Chromium processes are memory-intensive ($\sim 150\text{MB} - 300\text{MB}$ per instance).
* **The Constraint:** Running 20 unconstrained browser tabs simultaneously will crash an average 1GB–2GB RAM cloud node.
* **The Solution:** The BullMQ `executionWorker` uses a hard-coded concurrency ceiling:
  $$\text{Concurrency}_{\max} = 3$$
* This ensures that no more than 3 Chromium contexts ever exist in memory at once. Additional scheduled tasks queue harmlessly in Redis until a worker frees up.

### 6.2 The Three-Tier Anti-Bot Fallback Policy
Public websites periodically implement anti-scraping measures. OmniSentinel handles this gracefully:
1. **Stealth Headers:** Inject realistic desktop browser fingerprints (`User-Agent`, `Accept-Language`, `sec-ch-ua`).
2. **Resource Abort Filter:** Aborts network downloads for unnecessary media (videos, web-fonts, analytics beacons) to decrease page load time by 60%.
3. **Graceful Degradation (`BLOCKED` State):** If a site responds with `403 Forbidden`, Cloudflare Turnstile, or CAPTCHA, the system does not crash or loop endlessly. It updates the monitor state to `BLOCKED`, logs the incident, and surfaces an alert on the dashboard prompting the user to track an alternate public news feed.

### 6.3 Alert Fatigue Suppression (Auto-Snooze Protocol)
Without throttling, an hourly monitor on a discounted product would send 24 notifications per day.
* Once an alert conditions evaluates to `TRUE`:
  $$\text{status} \leftarrow \text{'TRIGGERED\_SNOOZED'}$$
  $$\text{snoozed\_until} \leftarrow \text{NOW}() + 48\text{ Hours}$$
* The scheduler ignores monitors in this state until the 48-hour window expires or the user explicitly clicks **"Re-arm Monitor"** from the web dashboard.

---

## 7. Security, Privacy & Network Boundaries

```text
[ Public Internet ]
        │
        ▼ (HTTPS / TLS 1.3)
┌────────────────────────────────────────────────────────┐
│ Cloudflare Edge / Vercel Ingress                      │
│ - DDoS Mitigation                                      │
│ - SSL Termination                                      │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ Internal Application Network (Railway / Render / VPS)  │
│                                                        │
│   [ Fastify Core API ]  ◄── Authenticated JWT          │
│            │                                           │
│            ├──► [ PostgreSQL (Supabase) ] (Encrypted)  │
│            │    - SSL Connection (Mode: Require)       │
│            │    - Row Level Security Enabled           │
│            │                                           │
│            └──► [ Redis (Upstash) ] (TLS Enabled)      │
│                 - Auth Token Required                  │
└────────────────────────────────────────────────────────┘
```

1. **Token Protection:** All third-party secrets (`GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `BREVO_API_KEY`) reside exclusively in server-side environment variables and are never bundled into client-facing Next.js code.
2. **Zero Financial Data Retention:** The platform never stores credit card credentials, bank account numbers, or login passwords. Bank toggles in the UI (e.g., `HDFC`, `ICICI`) simply act as string matching tags against the visible discount strings scraped from public e-commerce pages.
3. **Target Isolation:** The Playwright engine runs in isolated, ephemeral browser contexts (`incognito`). Cache, local storage, and cookies are purged immediately upon the termination of each scraping task.

---

## 8. Deployment Topology & Infrastructure Mapping

The architecture maps directly to modern free-to-low-cost production hosting tiers:

```text
┌───────────────────────────┬────────────────────────────┬─────────────────────────────┐
│ Subsystem                 │ Hosting Provider           │ Runtime / Container Specs   │
├───────────────────────────┼────────────────────────────┼─────────────────────────────┤
│ Frontend Web Client       │ Vercel                     │ Next.js 14+ (Edge / Server) │
│ Backend Core API & Queue  │ Railway / Render           │ Node.js 20 LTS (Dockerized) │
│ Playwright Worker Pool    │ Railway / Render (Worker)  │ Debian + Chromium Packages  │
│ Database (PostgreSQL)     │ Supabase / Neon            │ PostgreSQL 16 (Managed)     │
│ Message Broker (Redis)    │ Upstash / Redis Cloud      │ Redis 7.2 (Managed TLS)     │
│ Media Asset Bucket        │ Cloudinary                 │ CDN Hosted Image Storage    │
│ Transactional Email       │ Brevo                      │ REST API Delivery Engine    │
│ Instant Messaging         │ Telegram                   │ Bot API Gateway             │
└───────────────────────────┴────────────────────────────┴─────────────────────────────┘
```

---

## 9. Traceability Matrix: HLD vs. LLD

To maintain architectural alignment across documents, every block in this HLD corresponds directly to its structural definition in `LLD.md`:

| HLD Component | LLD Concrete Implementation |
| :--- | :--- |
| **Intent Routing** | `IntentAnalysisSchema` & Gemini Flash Classifier (`LLD Section 3`) |
| **State Store** | `users`, `monitors`, `check_logs`, `seen_jobs` DDL (`LLD Section 2`) |
| **Scheduler Engine** | BullMQ `monitor-scheduler-queue` (`LLD Section 5`) |
| **Domain Resolvers** | `IResolver` interface & individual resolver modules (`LLD Section 4`) |
| **Worker Concurrency** | `executionWorker` options (`concurrency: 3`) (`LLD Section 5`) |
| **API Endpoints** | `/api/v1/intent/parse`, `/api/v1/monitors` (`LLD Section 7`) |
| **Local Dev Safeguards** | `CONFIG.MOCK_MODE` environment switch (`LLD Section 8`) |