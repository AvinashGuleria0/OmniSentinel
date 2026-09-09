export const MONITOR_TYPES = ['ECOMMERCE', 'STOCK', 'JOB', 'GENERIC_WEB'] as const;
export type MonitorType = (typeof MONITOR_TYPES)[number];

export const MONITOR_STATUSES = ['ACTIVE', 'PAUSED', 'TRIGGERED_SNOOZED', 'BLOCKED'] as const;
export type MonitorStatus = (typeof MONITOR_STATUSES)[number];

export const CHECK_STATUSES = ['SUCCESS', 'FAILED', 'NO_CHANGE', 'CONDITION_MET', 'BLOCKED'] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export type ResolutionStatus = CheckStatus;

export const NOTIFICATION_CHANNELS = ['TELEGRAM', 'EMAIL', 'BOTH'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const CONDITION_OPERATORS = ['LT', 'GT', 'EQUALS', 'CONTAINS', 'NEW_ENTRY'] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];
