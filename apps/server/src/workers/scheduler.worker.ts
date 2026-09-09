import { and, eq, lte } from 'drizzle-orm';
import { ExecutionJobPayload } from '@omnisentinel/shared';
import { executionQueue } from '../queues';
import { db, monitors } from '../db';
import { logger } from '../utils/logger';

export class SchedulerService {
  private static intervalTimer: NodeJS.Timeout | null = null;

  /**
   * Executes a single scheduler poll cycle
   */
  public static async tick(): Promise<number> {
    const now = new Date();

    try {
      // 1. Re-arm monitors whose 48-hour auto-snooze has expired
      const unsnoozeResult = await db
        .update(monitors)
        .set({
          status: 'ACTIVE',
          snoozedUntil: null,
          nextRunAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(monitors.status, 'TRIGGERED_SNOOZED'),
            lte(monitors.snoozedUntil, now)
          )
        );

      // 2. Query active monitors that are due for checking
      const dueMonitors = await db
        .select()
        .from(monitors)
        .where(
          and(
            eq(monitors.status, 'ACTIVE'),
            lte(monitors.nextRunAt, now)
          )
        )
        .limit(50); // Bounded batch limit

      if (dueMonitors.length === 0) {
        return 0;
      }

      logger.info({ count: dueMonitors.length }, 'Scheduler found due monitors. Enqueueing tasks in batch...');

      // 3. Batch push tasks to BullMQ execution queue atomically
      const tasks = dueMonitors.map((m) => ({
        name: `check-${m.id}-${now.getTime()}`,
        data: {
          monitorId: m.id,
          userId: m.userId,
          type: m.type,
          targetUrl: m.targetUrl,
          targetSymbol: m.targetSymbol,
          conditionOperator: m.conditionOperator as any,
          targetValue: m.targetValue ? parseFloat(m.targetValue) : null,
          rawPrompt: m.rawPrompt,
          lastHash: m.lastContentHash,
          filterMetadata: (m.filterMetadata as any) || {},
        } as ExecutionJobPayload,
      }));

      await executionQueue.addBulk(tasks);

      return dueMonitors.length;
    } catch (err: any) {
      logger.error({ err: err?.message }, 'Scheduler tick failed');
      return 0;
    }
  }

  /**
   * Starts the recurring scheduler timer (runs every intervalSeconds)
   */
  public static start(intervalSeconds = 60): void {
    if (this.intervalTimer) return;

    logger.info({ intervalSeconds }, 'Starting background scheduler service...');

    // Run first tick immediately
    this.tick();

    this.intervalTimer = setInterval(() => {
      this.tick();
    }, intervalSeconds * 1000);
  }

  /**
   * Stops the background scheduler
   */
  public static stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      logger.info('Scheduler service stopped');
    }
  }
}
