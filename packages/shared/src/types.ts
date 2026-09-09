import { z } from 'zod';
import {
  IntentAnalysisSchema,
  PreviewItemSchema,
  ParseIntentResponseSchema,
  EcommerceExtractionSchema,
  BankOfferSchema,
  JobEntrySchema,
  ExecutionJobPayloadSchema,
  NotificationJobPayloadSchema,
  CreateMonitorInputSchema,
  UpdateMonitorInputSchema,
  FilterMetadataSchema,
} from './schemas';
import { CheckStatus } from './enums';

export type IntentAnalysis = z.infer<typeof IntentAnalysisSchema>;
export type PreviewItem = z.infer<typeof PreviewItemSchema>;
export type ParseIntentResponse = z.infer<typeof ParseIntentResponseSchema>;
export type EcommerceExtraction = z.infer<typeof EcommerceExtractionSchema>;
export type BankOffer = z.infer<typeof BankOfferSchema>;
export type JobEntry = z.infer<typeof JobEntrySchema>;
export type ExecutionJobPayload = z.infer<typeof ExecutionJobPayloadSchema>;
export type NotificationJobPayload = z.infer<typeof NotificationJobPayloadSchema>;
export type CreateMonitorInput = z.infer<typeof CreateMonitorInputSchema>;
export type UpdateMonitorInput = z.infer<typeof UpdateMonitorInputSchema>;
export type FilterMetadata = z.infer<typeof FilterMetadataSchema>;

// Resolution Result returned by any IResolver
export interface ResolutionResult {
  status: CheckStatus;
  currentValue: number | null;
  newHash: string | null;
  screenshotBuffer?: Buffer;
  extractedMetadata: Record<string, unknown>;
  notificationMessage?: string;
  actionUrl?: string;
  error?: string;
}

// Resolver strategy interface
export interface IResolver {
  resolve(payload: ExecutionJobPayload): Promise<ResolutionResult>;
}
