import { Browser, BrowserContext, chromium } from 'playwright';
import { logger } from '../../utils/logger';

export class BrowserManager {
  private static browserInstance: Browser | null = null;

  /**
   * Returns a singleton Chromium browser instance
   */
  public static async getBrowser(): Promise<Browser> {
    if (!this.browserInstance || !this.browserInstance.isConnected()) {
      logger.info('Launching Chromium browser instance for worker pool...');
      this.browserInstance = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
        ],
      });
    }
    return this.browserInstance;
  }

  /**
   * Creates a high-speed, stealth, ephemeral browser context
   */
  public static async createStealthContext(blockImages = true): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      locale: 'en-US,en;q=0.9',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (blockImages) {
      // Abort non-essential resources to accelerate check by >60%
      await context.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['media', 'font'].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }

    return context;
  }

  /**
   * Gracefully shuts down the browser instance
   */
  public static async closeBrowser(): Promise<void> {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
      logger.info('Chromium browser closed');
    }
  }
}
