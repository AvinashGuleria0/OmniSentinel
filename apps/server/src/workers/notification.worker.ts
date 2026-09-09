import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { NotificationJobPayload } from '@omnisentinel/shared';
import { QUEUE_NAMES } from '../queues';
import { getRedisConnection } from '../queues/connection';
import { TelegramDispatcher } from '../services/notifications/telegram.dispatcher';
import { BrevoDispatcher } from '../services/notifications/brevo.dispatcher';
import { db, users } from '../db';
import { logger } from '../utils/logger';

export function createNotificationWorker(): Worker<NotificationJobPayload> {
  const worker = new Worker<NotificationJobPayload>(
    QUEUE_NAMES.NOTIFICATION,
    async (job) => {
      const payload = job.data;
      logger.info({ monitorId: payload.monitorId, userId: payload.userId }, 'Processing notification dispatch job');

      // Fetch user notification preferences
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      const channel = user?.preferredChannel || 'TELEGRAM';
      const telegramId = user?.telegramChatId;
      const email = user?.email;

      let telegramSent = false;
      let emailSent = false;

      // 1. Dispatch via Telegram if preferred
      if (channel === 'TELEGRAM' || channel === 'BOTH') {
        telegramSent = await TelegramDispatcher.send(payload, telegramId);
      }

      // 2. Dispatch via Brevo Email if preferred
      if (channel === 'EMAIL' || channel === 'BOTH') {
        emailSent = await BrevoDispatcher.send(payload, email);
      }

      return { channel, telegramSent, emailSent };
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Notification worker job failed');
  });

  return worker;
}
