# syntax=docker/dockerfile:1
# OmniSentinel Backend (API & Worker) Multi-Stage Dockerfile
# Based on Playwright Jammy for battle-tested Chromium headless scraping

FROM mcr.microsoft.com/playwright:v1.44.0-jammy AS base

# Install Bun for lightning-fast TypeScript execution
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

# Step 1: Copy workspace manifests for dependency caching
COPY package.json bun.lock* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/

# Install dependencies
RUN bun install

# Step 2: Copy source code
COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/

# Build shared contracts
RUN bun --filter @omnisentinel/shared build || true

# Step 3: Install Playwright Chromium browser binary
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium

# Environment defaults
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

EXPOSE 4000

# Healthcheck targeting Fastify API gateway
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Default execution: boots the Fastify API Server
# Note: For worker container, override CMD to ["bun", "apps/server/src/workers/runner.ts"]
CMD ["bun", "apps/server/src/index.ts"]
