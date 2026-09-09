import { z } from 'zod';
import {
  MONITOR_TYPES,
  MONITOR_STATUSES,
  CHECK_STATUSES,
  NOTIFICATION_CHANNELS,
  CONDITION_OPERATORS,
} from './enums';

// Enums as Zod types
export const MonitorTypeSchema = z.enum(MONITOR_TYPES);
export const MonitorStatusSchema = z.enum(MONITOR_STATUSES);
export const CheckStatusSchema = z.enum(CHECK_STATUSES);
export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export const ConditionOperatorSchema = z.enum(CONDITION_OPERATORS);

// Filter metadata for e-commerce and generic tracking
export const FilterMetadataSchema = z.record(z.any());

// Intent Analysis Output Schema (Gemini Flash structured output)
export const IntentAnalysisSchema = z.object({
  type: MonitorTypeSchema.describe('Classified domain category'),
  title: z.string().describe('Concise display title for this monitor'),
  targetQuery: z.string().describe('Product name, stock symbol, job query, or search phrase'),
  conditionOperator: ConditionOperatorSchema.describe('Comparison operator to evaluate condition'),
  targetValue: z.number().nullable().describe('Target price, salary threshold, or null if checking existence'),
  currency: z.string().default('INR'),
  initialUrl: z.string().url().nullable().describe('Extracted or discovered URL if explicitly mentioned or resolved'),
  filterMetadata: FilterMetadataSchema.default({}),
  confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
});

// Preview Card Schema for Search-and-Confirm UX
export const PreviewItemSchema = z.object({
  title: z.string(),
  currentPrice: z.number().nullable(),
  currency: z.string().default('INR'),
  thumbnail: z.string().url().nullable().optional(),
  source: z.string(),
  url: z.string().url(),
  description: z.string().optional(),
});

// Response for POST /api/v1/intent/parse
export const ParseIntentResponseSchema = z.object({
  analysis: IntentAnalysisSchema,
  previewResults: z.array(PreviewItemSchema),
});

// E-Commerce Extracted Metadata
export const BankOfferSchema = z.object({
  bankName: z.string(),
  discountAmount: z.number(),
  description: z.string(),
});

export const EcommerceExtractionSchema = z.object({
  title: z.string(),
  basePrice: z.number(),
  currency: z.string().default('INR'),
  inStock: z.boolean(),
  universalCouponFound: z.boolean(),
  universalCouponDiscount: z.number().default(0),
  applicableBankOffers: z.array(BankOfferSchema).default([]),
  effectivePrice: z.number().describe('Calculated final price: base - coupon - max(active user bank discount)'),
});

// Job Entry Schema
export const JobEntrySchema = z.object({
  externalId: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  isRemote: z.boolean(),
  stipendAmount: z.number().nullable(),
  applyUrl: z.string().url(),
  postedDate: z.string().optional(),
});

// Queue Job Payloads
export const ExecutionJobPayloadSchema = z.object({
  monitorId: z.string().uuid(),
  userId: z.string().uuid(),
  type: MonitorTypeSchema,
  targetUrl: z.string().nullable(),
  targetSymbol: z.string().nullable(),
  conditionOperator: ConditionOperatorSchema,
  targetValue: z.number().nullable(),
  rawPrompt: z.string().optional(),
  lastHash: z.string().nullable(),
  filterMetadata: FilterMetadataSchema.default({}),
});

export const NotificationJobPayloadSchema = z.object({
  userId: z.string().uuid(),
  monitorId: z.string().uuid(),
  title: z.string(),
  currentValue: z.number().nullable(),
  targetValue: z.number().nullable(),
  message: z.string(),
  screenshotUrl: z.string().url().nullable().optional(),
  actionUrl: z.string().url(),
});

// REST API Schemas
export const CreateMonitorInputSchema = z.object({
  title: z.string().min(1).max(255),
  type: MonitorTypeSchema,
  targetUrl: z.string().url().nullable().optional(),
  targetSymbol: z.string().nullable().optional(),
  rawPrompt: z.string().min(3),
  conditionOperator: ConditionOperatorSchema,
  targetValue: z.number().nullable().optional(),
  currency: z.string().default('INR'),
  filterMetadata: FilterMetadataSchema.default({}),
  frequencyMinutes: z.number().int().min(5).default(60),
});

export const UpdateMonitorInputSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  status: MonitorStatusSchema.optional(),
  targetValue: z.number().nullable().optional(),
  filterMetadata: FilterMetadataSchema.optional(),
  frequencyMinutes: z.number().int().min(5).optional(),
});
