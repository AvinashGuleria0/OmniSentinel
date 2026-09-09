import { createExecutionWorker } from './execution.worker';
import { createNotificationWorker } from './notification.worker';
import { SchedulerService } from './scheduler.worker';
import { logger } from '../utils/logger';

let executionWorkerInstance: ReturnType<typeof createExecutionWorker> | null = null;
let notificationWorkerInstance: ReturnType<typeof createNotificationWorker> | null = null;

export function startWorkers(): void {
  logger.info('Starting OmniSentinel background worker pool...');
  executionWorkerInstance = createExecutionWorker();
  notificationWorkerInstance = createNotificationWorker();
  SchedulerService.start(60);
}

export async function stopWorkers(): Promise<void> {
  logger.info('Shutting down background workers...');
  SchedulerService.stop();

  if (executionWorkerInstance) {
    await executionWorkerInstance.close();
    executionWorkerInstance = null;
  }

  if (notificationWorkerInstance) {
    await notificationWorkerInstance.close();
    notificationWorkerInstance = null;
  }
}

export { createExecutionWorker, createNotificationWorker, SchedulerService };
