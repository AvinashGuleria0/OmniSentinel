# description.md: Complete Project Specification & Engineering Blueprint

**Project Title:** OmniSentinel (The Autonomous Multi-Source Intent-First Tracker)  
**System Class:** Distributed, Event-Driven Web State & Intent Sentinel  
**Target Architecture:** Next.js (App Router) + Node.js (TypeScript) + Fastify + PostgreSQL (Supabase) + Redis (BullMQ) + Playwright + Gemini Flash  

---

## 1. Executive Overview & The Problem Space

### 1.1 The Genesis of OmniSentinel
In the modern software engineering landscape, the vast majority of "AI projects" added to resumes fall into one of three repetitive categories:
1. Thin wrappers around a single OpenAI prompt.
2. Generic "Chat with your PDF" retrieval-augmented generation (RAG) clones following standard internet tutorials.
3. Chatbots that offer no persistent real-world utility beyond what a user could get by opening `chatgpt.com`.

These projects fail to impress recruiters and engineering leads because they lack **backend complexity, asynchronous event processing, relational data modeling, rate limiting, and real-world system resilience**.

At the same time, existing production web monitoring tools (such as Visualping, Distill.io, or ChangeDetection.io) suffer from a massive **User Experience (UX) friction problem**:
* They force the user to manually browse the web, find links, copy-paste long URLs into an input box, and manually select HTML elements or CSS selectors using clunky visual bounding boxes.
* They lack **semantic intent**: they cannot understand *what* the user actually wants (e.g., distinguishing between a base price drop, an on-page universal coupon, and an exclusive bank credit card discount).
* They fail when target websites update their CSS classes or change their layout, triggering endless false alarms.

### 1.2 The Solution
**OmniSentinel** is an autonomous, intent-driven monitoring platform. Instead of forcing users to act like automated web scrapers, OmniSentinel allows users to express their monitoring goals in **natural human language** through a single universal input bar:

> *"Alert me when Nike Air Max drops below ₹3,000 on Amazon with my HDFC card."*  
> *"Notify me when Airtel stock drops below ₹1,000."*  
> *"Tell me when there is a remote MERN stack software engineer internship with at least a ₹25,000/month stipend."*  
> *"Alert me when the University of Delhi releases the 2026 cutoff list."*

The system dynamically classifies the user's intent, resolves the target sources without manual URL hunting, executes cost-optimized polling cycles in the background, applies deterministic mathematical evaluation to prevent AI hallucinations, captures visual proof (screenshots), and dispatches instant notifications via Telegram and Email.

---

## 2. Core Functional Domains & Practical Use Cases

OmniSentinel is designed to be a generic, daily-driver tool for everyday users, students, job-seekers, and developers. It provides specialized execution strategies across four primary domains:

```text
                                [ OmniSentinel Universal Input ]
                                               │
               ┌───────────────────────┬───────┴───────────────┬────────────────────────┐
               ▼                       ▼                       ▼                        ▼
       [ 1. E-Commerce ]        [ 2. Stocks ]            [ 3. Careers ]        [ 4. Public Portals ]
       - Amazon / Flipkart      - NSE / BSE / Global    - Remote Internships   - University Cutoffs
       - On-Page Coupons        - 50ms REST API calls   - Stipend Extraction   - Exam Board Results
       - Bank Card Offers       - Market-Hour Gated     - Deduplication Engine - Marathon Registrations
```

### 2.1 E-Commerce Deals & Coupon Watcher
* **The User Pain Point:** Shoppers frequently track products across Amazon, Flipkart, or Myntra, waiting for a price drop. However, price drops on e-commerce are rarely just sticker price changes—they often take the form of **green "Apply Coupon" checkboxes**, festival sales (Diwali Sale, Prime Day, Big Billion Days), or **instant bank discounts** (e.g., 10% instant discount on HDFC/ICICI cards). Traditional scrapers miss these entirely.
* **The OmniSentinel Implementation:**
  * **Search & Confirm UX:** The user types *"Nike Air Pegasus"* into the app. The backend searches the platforms and returns the top 3 product cards with images and current prices. The user confirms the exact product and size in two clicks—**no copy-pasting URLs required**.
  * **Multi-Tier Discount Calculator:** The scraper evaluates both the base price and on-page discount mechanisms:
    $$\text{Effective Price} = \text{Base Price} - \text{Universal Coupon} - \max(\text{Active User Bank Discount})$$
  * **User Control Toggles:** Users can toggle whether they want raw sticker price alerts, universal coupon alerts, or specific bank card discounts (e.g., `[x] HDFC`, `[x] ICICI`, `[ ] SBI`).

### 2.2 Financial & Stock Sentinel
* **The User Pain Point:** Users want to be notified when high-value blue-chip stocks (e.g., Bharti Airtel, Reliance, Apple) drop to an attractive entry point (e.g., *"Notify me when Airtel drops below ₹1,000"*).
* **The Engineering Realization:** High-frequency stock trading does not belong in a headless browser scraper. Scraping a web page for a stock price wastes hundreds of megabytes of RAM, risks IP bans, and adds 3–5 seconds of latency.
* **The OmniSentinel Implementation:**
  * Uses dedicated financial REST APIs (`yfinance` / `yahoo-finance2` / AlphaVantage).
  * Executes sub-second, zero-cost HTTP lookups (consuming ~50ms and 0% CPU).
  * **Market-Hour Throttler:** The system automatically identifies exchange operating hours (e.g., NSE/BSE: Monday–Friday, 9:15 AM – 3:30 PM IST). Checks are paused during nights and weekends, saving 70%+ of database and network cycles.

### 2.3 Career & Internship Hunter
* **The User Pain Point:** Students and junior engineers spend hours every day manually checking LinkedIn, Indeed, and individual company career portals for specific openings (e.g., *"MERN stack intern, remote, ₹25,000/month stipend"*).
* **The OmniSentinel Implementation:**
  * The natural language parser converts the user's prompt into structured query parameters (`role: MERN Stack Intern`, `remote: true`, `min_stipend: 25000`).
  * Queries unified job aggregators (like JSearch / Google Jobs API), simultaneously scanning thousands of ATS boards (Workday, Greenhouse, Lever).
  * **Salary/Stipend Parser:** If the stipend is hidden inside the job description paragraph (e.g., *"We provide a competitive stipend of ₹25k/month"*), a regex/LLM extraction pipeline parses the exact number.
  * **Seen-Jobs Deduplication Engine:** Uses a cryptographic hash (`SHA-256(company + title + location)`) stored in a `seen_jobs` table to ensure users are **never alerted about the same job posting twice**.

### 2.4 Generic Public Web & Announcement Sentinel
* **The User Pain Point:** High-stakes public announcements have no public APIs or RSS feeds. Examples include university cutoff lists (e.g., Delhi University admission lists), board exam results, marathon registrations, or government tenders.
* **The OmniSentinel Implementation:**
  * If the user enters a request without a URL, an autonomous source discovery service queries search engines for the official portal domain (e.g., `du.ac.in`).
  * The user reviews and confirms the target domain.
  * The Playwright engine polls the page, strips noise, calculates a SHA-256 hash of the content, and invokes the LLM only when a real DOM difference occurs to verify if the specific event happened.

### 2.5 Scope Boundary: Public Portals vs. CAPTCHA/Login Walls
To maintain system stability, the platform explicitly focuses on **publicly accessible pages**. If a user requests tracking on a heavily protected transaction portal (such as IRCTC Tatkal or Passport Seva Kendra) that requires CAPTCHAs or OTP logins:
* Iframes cannot be used due to `X-Frame-Options: DENY` browser security headers and session cookie mismatches between client and cloud worker IPs.
* The system detects the anti-bot block (HTTP 403 / Cloudflare challenge), marks the monitor status as `BLOCKED`, and gracefully notifies the user to track a public news or announcement portal instead.

---

## 3. Revolutionary User Experience (UX) Architecture

OmniSentinel replaces the brittle UX of legacy scrapers with an intuitive, multi-stage interactive flow:

```text
[ Step 1: User Types Natural Language Prompt in Single Universal Search Bar ]
                                     │
                                     ▼
[ Step 2: Instant LLM Intent Classification & Discovery Service Query ]
                                     │
                                     ▼
[ Step 3: Interactive Confirmation Modal ]
    ├── E-Commerce: Shows 3 Preview Cards with images, prices, and size variants.
    ├── Filter Toggles: [x] Universal Coupons  [x] HDFC Card  [ ] ICICI Card
    └── Frequency Picker: Every 15 mins / 1 hour / 6 hours / Daily
                                     │
                                     ▼
[ Step 4: Monitor Locked & Stored in PostgreSQL ──► Background Queue Takes Over ]
```

### 3.1 Visual Proof (Screenshots as Evidence)
When an alert is delivered, users shouldn't have to wonder whether the AI hallucinated. 
* Every time a condition is met, Playwright captures a crisp **viewport or element screenshot** of the verified price tag or announcement banner.
* The screenshot is uploaded to Cloudinary CDN and embedded directly inside the Telegram message and Email notification.
* The user sees the visual proof on their phone before clicking through to buy or apply.

### 3.2 Anti-Alert Fatigue Protocol (Auto-Snooze)
* A common flaw in monitoring tools is infinite spam: if a product drops below the target price, an hourly monitor will ping the user 24 times a day.
* OmniSentinel implements an **Automated Snooze State Machine**:
  $$\text{ACTIVE} \xrightarrow{\text{Condition Met}} \text{TRIGGERED} \xrightarrow{\text{Alert Dispatched}} \text{TRIGGERED\_SNOOZED (48 Hours)}$$
* The monitor pauses checks for 48 hours unless the user manually clicks **"Re-arm Monitor"** or adjusts their target threshold.

### 3.3 Historical Price & Status Analytics
* Every check run records a lightweight entry in the `check_logs` table: `{ timestamp, recorded_value, status }`.
* The dashboard features an interactive **Recharts line chart** displaying the historical price trend or status timeline for each active monitor, providing immediate SaaS-grade visual polish.

---

## 4. Complete Technology Stack & Architectural Decisions

Every component of the tech stack was chosen to maximize performance, cost-efficiency, and software engineering resume impact.

| Architecture Layer | Technology Selected | Why It Was Chosen | Alternatives Considered & Rejected |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 14+ (App Router)** | Industry standard for modern full-stack engineering; excellent SSR, routing, and developer ecosystem. | **React (Vite):** Lacks built-in SSR and structured server actions. |
| **Styling & UI** | **Tailwind CSS + shadcn/ui** | Clean, accessible, modern SaaS component library with full source ownership. | **Material UI / Bootstrap:** Heavy bundle size, outdated design patterns. |
| **Backend Core & API** | **Node.js (TypeScript) + Fastify** | High-throughput asynchronous I/O; native TypeScript synergy with Next.js frontend; first-class Playwright support. | **Python (FastAPI):** Strong for AI, but Celery queue setup is notoriously complex compared to BullMQ.<br>**Java/Spring:** Overly verbose for rapid headless automation. |
| **Database** | **PostgreSQL (via Supabase)** | Strict relational data modeling for users, monitors, check logs, and job deduplication; native connection pooling. | **Firebase / MongoDB:** Rejected. NoSQL document stores make relational lookups and time-series scheduling queries clunky; BaaS hides backend engineering depth. |
| **Task Queue & Scheduler** | **BullMQ + Redis (Upstash / Local)** | Production-grade distributed task queue; native support for delayed jobs, exponential backoff retries, and concurrency limits. | **Node-cron (In-memory):** Unreliable; crashes on server restarts, cannot scale horizontally across worker nodes. |
| **Headless Automation** | **Playwright (Node.js)** | The modern standard for browser automation; superior async handling, auto-waiting, and native screenshot capabilities. | **Puppeteer / Selenium:** Slower, more brittle selector models, worse multi-tab isolation. |
| **Financial Data Engine** | **`yahoo-finance2` REST API** | Sub-second response times, zero token cost, zero browser memory overhead, highly reliable for global and NSE/BSE tickers. | **Scraping Finance Sites:** Flaky, memory-heavy, instant IP bans. |
| **Media & Asset Storage**| **Cloudinary** | Instant public CDN URLs with fast image transformation; generous free tier (25GB). | **AWS S3:** Great, but requires complex IAM, bucket policy, and CORS setup. Cloudinary is faster to deploy. |
| **Instant Alert Channel** | **Telegram Bot API** | Zero cost; delivers in < 1 second; supports inline image rendering for screenshot attachments directly on mobile. | **WhatsApp Business API:** Requires paid business verification and complex meta template approval. |
| **Email Alert Channel** | **Brevo (Sendinblue) REST API** | Free tier (300 emails/day), reliable inbox delivery, modern transactional templates without custom SMTP headaches. | **Personal Gmail SMTP:** Low delivery rates, 100 email/day limits, spam folder flags, looks amateur on a resume. |
| **AI Layer & LLM** | **Gemini Flash (Google AI Studio)** | Exceptional speed, low latency, cost-effective structured JSON schema enforcement via Zod. | **GPT-4o (Standard):** Too expensive and slow for frequent background extractions. |

---

## 5. End-to-End System Design & Mechanics

### 5.1 The Two-Tier Verification Model (Anti-Hallucination & Cost Saver)
Calling an LLM on every check cycle would bankrupt a solo developer. OmniSentinel uses an intelligent **two-tier pipeline**:

```text
[ Step 1: Headless Playwright Navigates to Target Page ]
                           │
                           ▼
[ Step 2: DOM Sanitization Engine (Strip <script>, <style>, <svg>, <iframe>, ads) ]
                           │
                           ▼
[ Step 3: Compute SHA-256 Hash of Remaining Text ]
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      [ Hash Unchanged ]          [ Hash Changed ]
             │                           │
   Terminate Cycle Early.         Invoke Gemini Flash with
   Record Status: NO_CHANGE       Strict Zod Output Schema
   Zero Token Cost ($0.00)               │
                                         ▼
                                 [ Structured JSON ]
                                 - base_price: 2499
                                 - coupon_discount: 500
                                 - bank_offers: [...]
                                         │
                                         ▼
                         [ Deterministic Runtime Math ]
                         EffectivePrice = Base - Coupon - Bank
                                         │
                         Is EffectivePrice <= TargetValue?
                                 ┌───────┴───────┐
                                 ▼               ▼
                              [ YES ]         [ NO ]
                           Trigger Alert    Update DB Log
```

* **The Rule:** The LLM is used exclusively as a **structured data extractor**. It never performs mathematical comparisons or logical decisions. The comparison (`if effective_price <= target_value`) is executed by deterministic TypeScript code.

### 5.2 Database Entity-Relationship (ER) Overview
The data layer is structured across four tightly coupled relational tables:
1. **`users`:** Stores authentication details, Telegram chat IDs, email addresses, and channel preferences.
2. **`monitors`:** Holds the core tracking entities—target URLs, ticker symbols, parsed user criteria, filter metadata (selected banks, coupons), cron frequencies, and execution states (`ACTIVE`, `PAUSED`, `TRIGGERED_SNOOZED`, `BLOCKED`).
3. **`check_logs`:** Append-only time-series ledger capturing the outcome of every run (`SUCCESS`, `NO_CHANGE`, `CONDITION_MET`, `FAILED`), recorded values, error metadata, and Cloudinary screenshot URLs.
4. **`seen_jobs`:** Fast indexing table storing cryptographic job hashes (`SHA-256(company + title + location)`) linked to specific users to prevent duplicate job notifications.

### 5.3 Bounded Concurrency & Worker Management
Headless browser instances consume significant memory (~150MB to 300MB of RAM each).
* To prevent server out-of-memory (OOM) crashes, the BullMQ worker enforces a strict concurrency ceiling:
  ```typescript
  concurrency: 3 // Exactly 3 Playwright instances running simultaneously
  ```
* If 50 monitors become due for checking at the same minute, they do not crash the machine; they sit in the Redis queue and are processed smoothly in batches of 3.

---

## 6. Development Safeguards & Anti-Abuse Controls

### 6.1 The Development Mock Mode (`MOCK_MODE=true`)
To ensure seamless development using AI code editors (like AntiGravity IDE with Gemini Flash) without incurring API charges, IP blocks, or spamming real devices during hot-reloads:
* Setting `MOCK_MODE=true` in `.env` activates mock adapters:
  * **Playwright Mock:** Returns pre-recorded HTML fixtures of Amazon/Flipkart/Notice pages instead of launching a live Chromium process.
  * **Notification Mock:** Logs formatted alert payloads and image buffers to the terminal instead of hitting Telegram or Brevo APIs.
  * **LLM Mock:** Returns deterministic JSON objects adhering to the Zod schemas without consuming Google AI Studio tokens.

### 6.2 Playwright Stealth & Bandwidth Optimization
When running live checks in production:
* Network request routing intercepts and **aborts heavy assets** (`image`, `media`, `font`, `stylesheet`), cutting page load time by over 60% and reducing proxy bandwidth consumption.
* Custom user agents and desktop headers are injected to simulate authentic human browsing sessions.

---

## 7. Software Engineering Resume Impact & Interview Talking Points

Building OmniSentinel demonstrates competence across the full spectrum of modern software engineering:

| Technical Challenge | What You Can Say in an Interview |
| :--- | :--- |
| **System Design & Distributed Queues** | *"I decoupled the web layer from the execution layer using Redis and BullMQ, implementing strict concurrency throttling to run headless browser workers without exhausting cloud memory."* |
| **Cost Optimization & LLM Efficiency** | *"I implemented a two-tier change detection algorithm using SHA-256 DOM hashing. By bypassing the LLM when page content hadn't changed, I eliminated over 90% of redundant AI token costs."* |
| **Reliability & Anti-Hallucination** | *"I avoided using the LLM for logical math. Instead, I enforced strict Zod schemas to extract raw figures and executed deterministic comparisons in TypeScript, ensuring 100% calculation accuracy."* |
| **Product Thinking & UX** | *"Rather than building another clunky scraper requiring users to paste URLs and CSS selectors, I engineered an Intent-First system that uses AI to parse user queries, preview targets, and automate the tracking lifecycle."* |
| **Performance Engineering** | *"I avoided the anti-pattern of using headless browsers for financial data, instead integrating lightweight REST APIs with market-hour throttling to deliver sub-second checks at zero compute cost."* |

---

## 8. Summary & Repository Readiness

OmniSentinel is not a toy, a prompt wrapper, or a throwaway tutorial. It is a complete, production-grade software system that bridges the gap between **Generative AI** and **Classical Systems Engineering**. 

It can be deployed immediately, operated on completely free hosting tiers (Vercel + Railway/Render + Supabase + Upstash + Cloudinary), and used on a daily basis by real people to track products, careers, financial assets, and public announcements.