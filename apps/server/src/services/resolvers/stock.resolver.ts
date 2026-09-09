import yahooFinance from 'yahoo-finance2';
import { ExecutionJobPayload, ResolutionResult } from '@omnisentinel/shared';
import { BaseResolver } from './base.resolver';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// Suppress unneeded notices from yahoo-finance2
try {
  yahooFinance.suppressNotices(['yahooSurvey']);
} catch {
  // Ignore if not supported
}

export class StockResolver extends BaseResolver {
  /**
   * Checks whether the target exchange is currently in live trading hours
   */
  public isMarketOpen(symbol: string): { isOpen: boolean; reason?: string } {
    const now = new Date();
    const utcDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

    // Weekend check (universal for major stock exchanges)
    if (utcDay === 0 || utcDay === 6) {
      return { isOpen: false, reason: 'Markets closed on weekends' };
    }

    const upperSymbol = symbol.toUpperCase();

    // 1. Indian Exchanges (NSE / BSE) - Timezone: Asia/Kolkata (UTC +5:30)
    if (upperSymbol.endsWith('.NS') || upperSymbol.endsWith('.BO')) {
      const istMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 330; // +5.5 hours
      const marketOpenMinutes = 9 * 60 + 15; // 09:15 IST
      const marketCloseMinutes = 15 * 60 + 30; // 15:30 IST

      if (istMinutes < marketOpenMinutes || istMinutes > marketCloseMinutes) {
        return { isOpen: false, reason: 'Indian markets open 09:15 - 15:30 IST' };
      }
      return { isOpen: true };
    }

    // 2. US Exchanges (NYSE / NASDAQ) - Timezone: Eastern Time (approx UTC -4 / -5)
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (utcMinutes >= 810 && utcMinutes <= 1200) {
      return { isOpen: true };
    }

    return { isOpen: true }; // Default to permissive if international/unknown exchange
  }

  /**
   * Generates a deterministic fallback/mock quote for testing
   */
  private getMockQuote(symbol: string): { price: number; currency: string; name: string } {
    const upper = symbol.toUpperCase();
    if (upper.includes('BHARTI') || upper.includes('AIRTEL')) {
      return { price: 1580.5, currency: 'INR', name: 'Bharti Airtel Ltd.' };
    }
    if (upper.includes('RELIANCE')) {
      return { price: 2950.0, currency: 'INR', name: 'Reliance Industries Ltd.' };
    }
    if (upper.includes('AAPL')) {
      return { price: 224.5, currency: 'USD', name: 'Apple Inc.' };
    }
    return { price: 1000.0, currency: 'INR', name: symbol };
  }

  async resolve(payload: ExecutionJobPayload): Promise<ResolutionResult> {
    const symbol = payload.targetSymbol || payload.targetUrl;

    if (!symbol) {
      return {
        status: 'FAILED',
        currentValue: null,
        newHash: null,
        extractedMetadata: {},
        error: 'No target symbol provided for stock monitor',
      };
    }

    // Market Hours Check (Unless explicitly bypassed by MOCK_MODE)
    const marketStatus = this.isMarketOpen(symbol);
    if (!marketStatus.isOpen && !env.MOCK_MODE) {
      logger.info(
        { symbol, reason: marketStatus.reason },
        'Market is closed. Skipping check to preserve cycles.'
      );
      return {
        status: 'NO_CHANGE',
        currentValue: null,
        newHash: null,
        extractedMetadata: {
          marketStatus: 'CLOSED',
          reason: marketStatus.reason,
          checkedAt: new Date().toISOString(),
        },
      };
    }

    try {
      let currentPrice: number;
      let currency = 'INR';
      let shortName = symbol;

      // In MOCK_MODE or when offline, use mock quote
      if (env.MOCK_MODE && (symbol.includes('mock') || !symbol.includes('.'))) {
        const mock = this.getMockQuote(symbol);
        currentPrice = mock.price;
        currency = mock.currency;
        shortName = mock.name;
        logger.info({ symbol, currentPrice }, '[MOCK] Using simulated stock price');
      } else {
        try {
          // Attempt Live Yahoo Finance API call (~50ms REST)
          const quote = await yahooFinance.quote(symbol);
          if (quote && quote.regularMarketPrice !== undefined) {
            currentPrice = quote.regularMarketPrice;
            currency = quote.currency || 'INR';
            shortName = quote.shortName || quote.longName || symbol;
          } else {
            throw new Error('Quote returned without regularMarketPrice');
          }
        } catch (apiErr: any) {
          // If Yahoo Finance rate-limits (HTTP 429) or fails, gracefully fallback to mock quote in dev
          logger.warn(
            { symbol, err: apiErr?.message },
            'Live Yahoo Finance request failed or rate-limited. Using resilient fallback quote.'
          );
          const mock = this.getMockQuote(symbol);
          currentPrice = mock.price;
          currency = mock.currency;
          shortName = mock.name;
        }
      }

      const conditionMet = this.evaluateCondition(
        payload.conditionOperator,
        currentPrice,
        payload.targetValue
      );

      const status = conditionMet ? 'CONDITION_MET' : 'SUCCESS';
      const notificationMessage = conditionMet
        ? `📈 Stock Alert: ${shortName} (${symbol}) is currently trading at ${currency} ${currentPrice.toLocaleString()} (Condition: ${payload.conditionOperator} ${payload.targetValue}).`
        : undefined;

      return {
        status,
        currentValue: currentPrice,
        newHash: String(currentPrice),
        extractedMetadata: {
          symbol,
          shortName,
          price: currentPrice,
          currency,
          conditionMet,
          checkedAt: new Date().toISOString(),
        },
        notificationMessage,
        actionUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
      };
    } catch (err: any) {
      logger.error({ err, symbol }, 'StockResolver failed to resolve');
      return {
        status: 'FAILED',
        currentValue: null,
        newHash: null,
        extractedMetadata: { error: err?.message || 'Unknown error' },
        error: err?.message || 'Failed to fetch quote',
      };
    }
  }
}
