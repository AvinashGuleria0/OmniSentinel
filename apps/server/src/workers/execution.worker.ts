import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { ExecutionJobPayload } from '@omnisentinel/shared';
import { QUEUE_NAMES, notificationQueue } from '../queues';
import { getRedisConnection } from '../queues/connection';
import { ResolverFactory } from '../services/resolvers/resolver.factory';
import { CloudinaryService } from '../services/storage/cloudinary.service';
import { db, monitors, checkLogs } from '../db';
import { logger } from '../utils/logger';

export function createExecutionWorker(): Worker<ExecutionJobPayload> {
  const worker = new Worker<ExecutionJobPayload>(
    QUEUE_NAMES.EXECUTION,
    async (job) => {
      const payload = job.data;
      logger.info({ monitorId: payload.monitorId, type: payload.type }, 'Starting monitor execution job');

      const result = await ResolverFactory.resolve(payload);
      logger.info(
        { monitorId: payload.monitorId, status: result.status, value: result.currentValue },
        'Monitor resolved'
      );

      // 1. Upload screenshot if available
      let screenshotUrl: string | null = null;
      if (result.screenshotBuffer) {
        screenshotUrl = await CloudinaryService.uploadScreenshot(result.screenshotBuffer, payload.monitorId);
      }

      const now = new Date();

      // 2. Fetch current monitor to determine frequency
      const [currentMonitor] = await db
        .select()
        .from(monitors)
        .where(eq(monitors.id, payload.monitorId))
        .limit(1);

      const frequencyMinutes = currentMonitor?.frequencyMinutes || 60;
      const nextRun = new Date(now.getTime() + frequencyMinutes * 60 * 1000);

      if (result.status === 'CONDITION_MET') {
        // Condition met -> Trigger Auto-Snooze state machine (48-hour snooze window)
        const snoozedUntil = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        await db
          .update(monitors)
          .set({
            status: 'TRIGGERED_SNOOZED',
            snoozedUntil,
            lastCheckedAt: now,
            lastContentHash: result.newHash || currentMonitor?.lastContentHash,
            lastKnownValue: result.currentValue ? String(result.currentValue) : currentMonitor?.lastKnownValue,
            consecutiveFailures: 0,
            updatedAt: now,
          })
          .where(eq(monitors.id, payload.monitorId));

        // Insert into check_logs
        await db.insert(checkLogs).values({
          monitorId: payload.monitorId,
          status: 'CONDITION_MET',
          recordedValue: result.currentValue ? String(result.currentValue) : null,
          metadata: result.extractedMetadata,
          screenshotUrl,
        });

        // Push alert to notification queue
        await notificationQueue.add(`notify-${payload.monitorId}-${now.getTime()}`, {
          userId: payload.userId,
          monitorId: payload.monitorId,
          title: currentMonitor?.title || 'Condition Met',
          currentValue: result.currentValue,
          targetValue: payload.targetValue,
          message: result.notificationMessage || 'Tracking condition was successfully satisfied.',
          screenshotUrl: screenshotUrl || undefined,
          actionUrl: result.actionUrl || payload.targetUrl || 'https://omnisentinel.dev',
        });
      } else if (result.status === 'BLOCKED') {
        // Anti-bot block encountered -> Transition monitor to BLOCKED state
        await db
          .update(monitors)
          .set({
            status: 'BLOCKED',
            lastCheckedAt: now,
            updatedAt: now,
          })
          .where(eq(monitors.id, payload.monitorId));

        await db.insert(checkLogs).values({
          monitorId: payload.monitorId,
          status: 'FAILED',
          metadata: { ...result.extractedMetadata, error: result.error },
        });
      } else if (result.status === 'NO_CHANGE') {
        // Content unchanged -> Advance next_run_at with zero AI cost
        await db
          .update(monitors)
          .set({
            lastCheckedAt: now,
            nextRunAt: nextRun,
            updatedAt: now,
          })
          .where(eq(monitors.id, payload.monitorId));

        await db.insert(checkLogs).values({
          monitorId: payload.monitorId,
          status: 'NO_CHANGE',
          metadata: result.extractedMetadata,
        });
      } else if (result.status === 'SUCCESS') {
        // Checked successfully, condition not met -> Advance next_run_at
        await db
          .update(monitors)
          .set({
            lastCheckedAt: now,
            nextRunAt: nextRun,
            lastContentHash: result.newHash || currentMonitor?.lastContentHash,
            lastKnownValue: result.currentValue ? String(result.currentValue) : currentMonitor?.lastKnownValue,
            consecutiveFailures: 0,
            updatedAt: now,
          })
          .where(eq(monitors.id, payload.monitorId));

        await db.insert(checkLogs).values({
          monitorId: payload.monitorId,
          status: 'SUCCESS',
          recordedValue: result.currentValue ? String(result.currentValue) : null,
          metadata: result.extractedMetadata,
          screenshotUrl,
        });
      } else {
        // FAILED
        const failures = (currentMonitor?.consecutiveFailures || 0) + 1;
        await db
          .update(monitors)
          .set({
            lastCheckedAt: now,
            nextRunAt: nextRun,
            consecutiveFailures: failures,
            updatedAt: now,
          })
          .where(eq(monitors.id, payload.monitorId));

        await db.insert(checkLogs).values({
          monitorId: payload.monitorId,
          status: 'FAILED',
          metadata: { error: result.error || 'Execution failed' },
        });
      }

      return { status: result.status, value: result.currentValue };
    },
    {
      connection: getRedisConnection(),
      concurrency: 3, // Strict bounded concurrency to prevent browser RAM exhaustion
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Execution worker job failed');
  });

  return worker;
}
