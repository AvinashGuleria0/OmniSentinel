import { NotificationJobPayload } from '@omnisentinel/shared';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export class BrevoDispatcher {
  /**
   * Dispatches an alert email to a user using the Brevo REST API
   */
  public static async send(payload: NotificationJobPayload, recipientEmail?: string | null): Promise<boolean> {
    const email = recipientEmail || 'demo@omnisentinel.dev';

    if (!env.BREVO_API_KEY || env.MOCK_MODE) {
      logger.info(
        { email, title: payload.title, message: payload.message },
        '[MOCK] Brevo Transactional Email dispatched'
      );
      return true;
    }

    try {
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 24px; }
    .card { background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; max-width: 600px; margin: 0 auto; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
    .badge { display: inline-block; background-color: #0284c7; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
    h1 { font-size: 22px; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #a1a1aa; margin-bottom: 24px; }
    .screenshot { max-width: 100%; border-radius: 8px; border: 1px solid #27272a; margin-bottom: 24px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center; }
    .footer { text-align: center; font-size: 12px; color: #71717a; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">OmniSentinel Alert</div>
    <h1>${payload.title}</h1>
    <p>${payload.message}</p>
    ${payload.screenshotUrl ? `<img src="${payload.screenshotUrl}" alt="Visual Proof" class="screenshot" />` : ''}
    <div style="margin-top: 24px;">
      <a href="${payload.actionUrl}" class="btn" target="_blank">View Target Page &rarr;</a>
    </div>
  </div>
  <div class="footer">
    Sent autonomously by OmniSentinel &bull; Anti-Alert Fatigue Active
  </div>
</body>
</html>
      `;

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: env.BREVO_SENDER_NAME || 'OmniSentinel Alerts',
            email: env.BREVO_SENDER_EMAIL || 'alerts@omnisentinel.dev',
          },
          to: [{ email }],
          subject: `[OmniSentinel] ${payload.title}`,
          htmlContent,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Brevo API responded with status ${response.status}: ${errorText}`);
      }

      logger.info({ email, title: payload.title }, 'Brevo email delivered successfully');
      return true;
    } catch (err: any) {
      logger.error({ err: err?.message, email }, 'Failed to send email via Brevo');
      return false;
    }
  }
}
