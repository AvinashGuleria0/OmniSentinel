import { ExecutionJobPayload, ResolutionResult } from '@omnisentinel/shared';
import { BaseResolver } from './base.resolver';
import { BrowserManager } from '../scraping/browser.manager';
import { MOCK_UNIVERSITY_NOTICE_HTML } from '../../fixtures/mock.fixtures';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export class GenericWebResolver extends BaseResolver {
  async resolve(payload: ExecutionJobPayload): Promise<ResolutionResult> {
    const url = payload.targetUrl;

    if (!url) {
      return {
        status: 'FAILED',
        currentValue: null,
        newHash: null,
        extractedMetadata: {},
        error: 'Target URL is required for Generic Web monitor',
      };
    }

    try {
      let pageText = '';
      let screenshotBuffer: Buffer | undefined;

      // 1. MOCK MODE CHECK
      if (env.MOCK_MODE && (url.includes('du.ac.in') || url.includes('mock') || !url.startsWith('http'))) {
        logger.info({ url }, '[MOCK] Using pre-recorded university notice fixture');
        pageText = this.cleanText(
          'University of Delhi Admissions & Cutoffs Notice Board. Press Release: UG Admissions Policy 2026. First Cutoff List for Undergraduate Courses 2026 Announced!'
        );
        screenshotBuffer = Buffer.from('mock_notice_screenshot');
      } else {
        // 2. LIVE HEADLESS BROWSER
        const context = await BrowserManager.createStealthContext(true);
        const page = await context.newPage();

        try {
          const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
          });

          const status = response?.status() || 200;
          if (status === 403 || status === 429) {
            await context.close();
            return {
              status: 'BLOCKED',
              currentValue: null,
              newHash: null,
              extractedMetadata: { httpStatus: status },
              error: `Target announcement portal blocked access (HTTP ${status})`,
            };
          }

          pageText = await page.evaluate(() => {
            const elementsToRemove = document.querySelectorAll('script, style, svg, iframe, noscript');
            elementsToRemove.forEach((el) => el.remove());
            return document.body?.innerText || '';
          });

          pageText = this.cleanText(pageText.slice(0, 10000));

          screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 75,
            fullPage: false,
          });
        } finally {
          await context.close();
        }
      }

      // 3. SHA-256 HASH VERIFICATION
      const currentHash = this.computeHash(pageText);

      if (payload.lastHash && payload.lastHash === currentHash) {
        logger.info({ url, currentHash }, 'Generic web content unchanged. Skipping alert.');
        return {
          status: 'NO_CHANGE',
          currentValue: null,
          newHash: currentHash,
          extractedMetadata: { unchanged: true, checkedAt: new Date().toISOString() },
        };
      }

      // 4. CONDITION MATCHING
      let conditionMet = true;
      const targetQuery = payload.targetSymbol || payload.rawPrompt || '';

      if (payload.conditionOperator === 'CONTAINS' && targetQuery) {
        // Keyword containment check
        const keywords = targetQuery
          .toLowerCase()
          .replace(/alert|notify|me|when|drops|releases|the|for|list/g, '')
          .trim()
          .split(/\s+/)
          .filter((w: string) => w.length > 2);

        conditionMet = keywords.some((k: string) => pageText.toLowerCase().includes(k));
      }

      const status = conditionMet ? 'CONDITION_MET' : 'SUCCESS';
      const notificationMessage = conditionMet
        ? `📢 Web Update Detected on ${url}: Relevant content update identified matching your tracking criteria.`
        : undefined;

      return {
        status,
        currentValue: 1, // Flag indicating active presence
        newHash: currentHash,
        screenshotBuffer,
        extractedMetadata: {
          url,
          textSnippet: pageText.slice(0, 300),
          conditionMet,
          checkedAt: new Date().toISOString(),
        },
        notificationMessage,
        actionUrl: url,
      };
    } catch (err: any) {
      logger.error({ err, url }, 'GenericWebResolver failed');
      return {
        status: 'FAILED',
        currentValue: null,
        newHash: null,
        extractedMetadata: { error: err?.message },
        error: err?.message,
      };
    }
  }
}
