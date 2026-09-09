import { NotificationJobPayload } from '@omnisentinel/shared';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export class TelegramDispatcher {
  /**
   * Dispatches an alert to a user's Telegram chat
   */
  public static async send(payload: NotificationJobPayload, chatId?: string | null): Promise<boolean> {
    const targetChatId = chatId || '123456789';

    if (!env.TELEGRAM_BOT_TOKEN || env.MOCK_MODE) {
      logger.info(
        { targetChatId, title: payload.title, message: payload.message, screenshotUrl: payload.screenshotUrl },
        '[MOCK] Telegram Notification dispatched'
      );
      return true;
    }

    try {
      const caption = `🚨 *${payload.title}*\n\n${payload.message}\n\n🔗 [Open Link](${payload.actionUrl})`;

      if (payload.screenshotUrl) {
        // Send Photo with inline button
        const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChatId,
            photo: payload.screenshotUrl,
            caption,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: 'View Target Page', url: payload.actionUrl }]],
            },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Telegram sendPhoto failed: ${res.status} - ${errText}`);
        }
      } else {
        // Send plain Markdown message
        const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChatId,
            text: caption,
            parse_mode: 'Markdown',
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Telegram sendMessage failed: ${res.status} - ${errText}`);
        }
      }

      logger.info({ targetChatId, title: payload.title }, 'Telegram notification successfully delivered');
      return true;
    } catch (err: any) {
      logger.error({ err: err?.message, targetChatId }, 'Failed to dispatch Telegram message');
      return false;
    }
  }
}
