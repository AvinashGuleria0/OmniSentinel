import {
  EcommerceExtraction,
  EcommerceExtractionSchema,
  ExecutionJobPayload,
  ResolutionResult,
} from '@omnisentinel/shared';
import { BaseResolver } from './base.resolver';
import { BrowserManager } from '../scraping/browser.manager';
import { getGeminiFlashModel } from '../intent/gemini.client';
import { MOCK_AMAZON_HTML } from '../../fixtures/mock.fixtures';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export class EcommerceResolver extends BaseResolver {
  async resolve(payload: ExecutionJobPayload): Promise<ResolutionResult> {
    const url = payload.targetUrl;

    if (!url) {
      return {
        status: 'FAILED',
        currentValue: null,
        newHash: null,
        extractedMetadata: {},
        error: 'Missing target URL for e-commerce monitor',
      };
    }

    try {
      let pageText = '';
      let screenshotBuffer: Buffer | undefined;

      // 1. MOCK MODE CHECK
      if (env.MOCK_MODE && (url.includes('example.com') || url.includes('mock') || !url.startsWith('http'))) {
        logger.info({ url }, '[MOCK] Using pre-recorded e-commerce HTML fixture');
        pageText = this.cleanText(
          'Nike Air Max SYSTM Men Running Shoes. Price: ₹3,495. Apply ₹500 coupon. Bank Offer: 10% Instant Discount up to ₹1000 on HDFC Bank Credit Card.'
        );
        screenshotBuffer = Buffer.from('mock_screenshot_data');
      } else {
        try {
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
                error: `Target website blocked the request (HTTP ${status})`,
              };
            }

            // Strip unnecessary HTML elements directly inside the page context
            pageText = await page.evaluate(() => {
              const elementsToRemove = document.querySelectorAll(
                'script, style, svg, iframe, noscript, nav, footer, header'
              );
              elementsToRemove.forEach((el) => el.remove());
              return document.body?.innerText || '';
            });

            pageText = this.cleanText(pageText.slice(0, 5000));

            // Capture a screenshot of the top viewport / product area
            screenshotBuffer = await page.screenshot({
              type: 'jpeg',
              quality: 80,
              fullPage: false,
            });
          } finally {
            await context.close();
          }
        } catch (browserErr: any) {
          if (env.MOCK_MODE) {
            logger.warn(
              { url, err: browserErr?.message },
              '[MOCK] Live browser unavailable. Falling back to pre-recorded fixture.'
            );
            pageText = this.cleanText(
              'Nike Air Max SYSTM Men Running Shoes. Price: ₹3,495. Apply ₹500 coupon. Bank Offer: 10% Instant Discount up to ₹1000 on HDFC Bank Credit Card.'
            );
            screenshotBuffer = Buffer.from('mock_screenshot_data');
          } else {
            throw browserErr;
          }
        }
      }

      // 3. TIER 1: SHA-256 CONTENT HASH CHECK
      const currentHash = this.computeHash(pageText);
      if (payload.lastHash && payload.lastHash === currentHash) {
        logger.info({ url, hash: currentHash }, 'E-commerce content hash unchanged. Terminating cycle early.');
        return {
          status: 'NO_CHANGE',
          currentValue: null,
          newHash: currentHash,
          extractedMetadata: { unchanged: true, checkedAt: new Date().toISOString() },
        };
      }

      // 4. TIER 2: STRUCTURED EXTRACTION VIA GEMINI FLASH
      let extraction: EcommerceExtraction;

      if (env.MOCK_MODE && (!env.GEMINI_API_KEY || url.includes('mock'))) {
        // Deterministic mock extraction
        extraction = {
          title: 'Nike Air Max SYSTM Men Running Shoes',
          basePrice: 3495,
          currency: 'INR',
          inStock: true,
          universalCouponFound: true,
          universalCouponDiscount: 500,
          applicableBankOffers: [
            {
              bankName: 'HDFC',
              discountAmount: 349.5,
              description: '10% instant discount on HDFC Card',
            },
          ],
          effectivePrice: 2645.5,
        };
      } else {
        const model = getGeminiFlashModel(true);
        const prompt = `
You are a precise e-commerce data extraction engine. Extract product pricing, coupons, and bank offers from the following page text.
Respond with a JSON object matching this schema:
{
  "title": string,
  "basePrice": number,
  "currency": string,
  "inStock": boolean,
  "universalCouponFound": boolean,
  "universalCouponDiscount": number,
  "applicableBankOffers": [
    {
      "bankName": string,
      "discountAmount": number,
      "description": string
    }
  ]
}

Page Content:
"""
${pageText}
"""
`;
        const result = await model.generateContent(prompt);
        const jsonText = result.response.text();
        const parsed = JSON.parse(jsonText);
        extraction = {
          ...parsed,
          effectivePrice: parsed.basePrice || 0,
        };
      }

      // 5. DETERMINISTIC MULTI-TIER DISCOUNT CALCULATION (TypeScript Runtime)
      let effectivePrice = extraction.basePrice;
      const filterMeta = payload.filterMetadata || {};

      // A. Apply Universal On-Page Coupon if enabled by user
      if (filterMeta.include_coupons !== false && extraction.universalCouponFound) {
        effectivePrice -= extraction.universalCouponDiscount || 0;
      }

      // B. Apply User Bank Card Discount if specified
      const selectedBanks = (filterMeta.selected_banks as string[]) || [];
      if (selectedBanks.length > 0 && extraction.applicableBankOffers?.length > 0) {
        const matchingBankDiscounts = extraction.applicableBankOffers
          .filter((offer) =>
            selectedBanks.some((b) => offer.bankName.toLowerCase().includes(b.toLowerCase()))
          )
          .map((o) => o.discountAmount);

        if (matchingBankDiscounts.length > 0) {
          const maxBankDiscount = Math.max(...matchingBankDiscounts);
          effectivePrice -= maxBankDiscount;
        }
      }

      // Round to 2 decimals
      effectivePrice = Math.round(effectivePrice * 100) / 100;
      extraction.effectivePrice = effectivePrice;

      // 6. CONDITION EVALUATION
      const conditionMet = this.evaluateCondition(
        payload.conditionOperator,
        effectivePrice,
        payload.targetValue
      );

      const status = conditionMet ? 'CONDITION_MET' : 'SUCCESS';
      const notificationMessage = conditionMet
        ? `🏷️ Deal Alert: ${extraction.title} dropped to ${extraction.currency} ${effectivePrice.toLocaleString()}! (Target: ${payload.targetValue}). Base: ${extraction.basePrice}, Coupon: -${extraction.universalCouponDiscount}.`
        : undefined;

      return {
        status,
        currentValue: effectivePrice,
        newHash: currentHash,
        screenshotBuffer,
        extractedMetadata: {
          ...extraction,
          filterApplied: filterMeta,
          evaluatedAt: new Date().toISOString(),
        },
        notificationMessage,
        actionUrl: url,
      };
    } catch (err: any) {
      logger.error({ err, url }, 'EcommerceResolver failed');
      return {
        status: 'FAILED',
        currentValue: null,
        newHash: null,
        extractedMetadata: { error: err?.message || 'Scraping error' },
        error: err?.message || 'Scraping error',
      };
    }
  }
}
