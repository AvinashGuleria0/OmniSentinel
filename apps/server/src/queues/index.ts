import { Queue, QueueOptions } from 'bullmq';
import { getRedisConnection } from './connection';
import { ExecutionJobPayload, NotificationJobPayload } from '@omnisentinel/shared';

export const QUEUE_NAMES = {
  SCHEDULER: 'monitor-scheduler-queue',
  EXECUTION: 'execution-queue',
  NOTIFICATION: 'notification-queue',
} as const;

const defaultQueueOptions: QueueOptions = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 25s, 125s
    },
    removeOnComplete: true,
    removeOnFail: 100,
  },
};

export const schedulerQueue = new Queue(QUEUE_NAMES.SCHEDULER, defaultQueueOptions);
export const executionQueue = new Queue<ExecutionJobPayload>(QUEUE_NAMES.EXECUTION, defaultQueueOptions);
export const notificationQueue = new Queue<NotificationJobPayload>(QUEUE_NAMES.NOTIFICATION, defaultQueueOptions);
