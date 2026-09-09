import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import {
  MONITOR_TYPES,
  MONITOR_STATUSES,
  CHECK_STATUSES,
  NOTIFICATION_CHANNELS,
} from '@omnisentinel/shared';

// Database Enums
export const monitorTypeEnum = pgEnum('monitor_type', MONITOR_TYPES);
export const monitorStatusEnum = pgEnum('monitor_status', MONITOR_STATUSES);
export const checkStatusEnum = pgEnum('check_status', CHECK_STATUSES);
export const notificationChannelEnum = pgEnum('notification_channel', NOTIFICATION_CHANNELS);

// 1. Users Table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  telegramChatId: varchar('telegram_chat_id', { length: 100 }),
  preferredChannel: notificationChannelEnum('preferred_channel').default('TELEGRAM'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Monitors Table
export const monitors = pgTable(
  'monitors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    type: monitorTypeEnum('type').notNull(),
    status: monitorStatusEnum('status').default('ACTIVE').notNull(),

    // Target Identifiers
    targetUrl: text('target_url'),
    targetSymbol: varchar('target_symbol', { length: 50 }),

    // Intent & Condition Criteria
    rawPrompt: text('raw_prompt').notNull(),
    conditionOperator: varchar('condition_operator', { length: 20 }).notNull(),
    targetValue: numeric('target_value', { precision: 12, scale: 2 }),
    currency: varchar('currency', { length: 10 }).default('INR').notNull(),

    // Flexible Filter Metadata (selected banks, coupons, etc.)
    filterMetadata: jsonb('filter_metadata').default({}).notNull(),

    // Execution & Scheduling
    frequencyMinutes: integer('frequency_minutes').default(60).notNull(),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).defaultNow().notNull(),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),

    // Change Detection State
    lastContentHash: varchar('last_content_hash', { length: 64 }),
    lastKnownValue: numeric('last_known_value', { precision: 12, scale: 2 }),
    consecutiveFailures: integer('consecutive_failures').default(0).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    schedulerIdx: index('idx_monitors_scheduler').on(table.status, table.nextRunAt),
    userMonitorsIdx: index('idx_monitors_user_id').on(table.userId),
  })
);

// 3. Check Logs Table (Historical time-series ledger)
export const checkLogs = pgTable(
  'check_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => monitors.id, { onDelete: 'cascade' }),
    status: checkStatusEnum('status').notNull(),
    recordedValue: numeric('recorded_value', { precision: 12, scale: 2 }),
    metadata: jsonb('metadata').default({}).notNull(),
    screenshotUrl: text('screenshot_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    trendIdx: index('idx_check_logs_trend').on(table.monitorId, table.createdAt),
  })
);

// 4. Seen Jobs Table (Deduplication engine)
export const seenJobs = pgTable(
  'seen_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => monitors.id, { onDelete: 'cascade' }),
    jobHash: varchar('job_hash', { length: 64 }).notNull(),
    jobTitle: varchar('job_title', { length: 255 }).notNull(),
    companyName: varchar('company_name', { length: 255 }).notNull(),
    applyUrl: text('apply_url').notNull(),
    firstDetectedAt: timestamp('first_detected_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dedupIdx: index('idx_seen_jobs_dedup').on(table.userId, table.jobHash),
  })
);

// Relational Definitions
export const usersRelations = relations(users, ({ many }) => ({
  monitors: many(monitors),
  seenJobs: many(seenJobs),
}));

export const monitorsRelations = relations(monitors, ({ one, many }) => ({
  user: one(users, {
    fields: [monitors.userId],
    references: [users.id],
  }),
  checkLogs: many(checkLogs),
  seenJobs: many(seenJobs),
}));

export const checkLogsRelations = relations(checkLogs, ({ one }) => ({
  monitor: one(monitors, {
    fields: [checkLogs.monitorId],
    references: [monitors.id],
  }),
}));

export const seenJobsRelations = relations(seenJobs, ({ one }) => ({
  user: one(users, {
    fields: [seenJobs.userId],
    references: [users.id],
  }),
  monitor: one(monitors, {
    fields: [seenJobs.monitorId],
    references: [monitors.id],
  }),
}));

// Inferred Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Monitor = typeof monitors.$inferSelect;
export type NewMonitor = typeof monitors.$inferInsert;
export type CheckLog = typeof checkLogs.$inferSelect;
export type NewCheckLog = typeof checkLogs.$inferInsert;
export type SeenJob = typeof seenJobs.$inferSelect;
export type NewSeenJob = typeof seenJobs.$inferInsert;
