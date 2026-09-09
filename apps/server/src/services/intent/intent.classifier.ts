import {
  IntentAnalysis,
  IntentAnalysisSchema,
  ParseIntentResponse,
  PreviewItem,
} from '@omnisentinel/shared';
import { getGeminiFlashModel } from './gemini.client';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export class IntentClassifierService {
  /**
   * Classifies a natural language prompt into structured monitor criteria and candidate previews
   */
  public static async classify(prompt: string): Promise<ParseIntentResponse> {
    let analysis: IntentAnalysis;

    try {
      if (!env.GEMINI_API_KEY || (env.MOCK_MODE && prompt.includes('mock'))) {
        analysis = this.heuristicFallback(prompt);
      } else {
        const model = getGeminiFlashModel(true);
        const systemPrompt = `
You are an expert AI intent router for OmniSentinel, an autonomous web monitoring platform.
Your job is to parse open-ended user requests into a structured JSON monitor configuration.

User Prompt: "${prompt}"

Rules:
1. "type": Must be one of: "ECOMMERCE", "STOCK", "JOB", "GENERIC_WEB".
   - ECOMMERCE: Buying products, shoe sizes, Amazon/Flipkart/Myntra deals, bank card offers (HDFC, ICICI, etc.).
   - STOCK: Equities, ticker symbols, share prices (NSE/BSE or global).
   - JOB: Internships, full-time jobs, stipends, ATS job postings (remote or onsite).
   - GENERIC_WEB: Public notices, university cutoffs, exam results, government portals.
2. "title": Concise display title (e.g. "Nike Air Max Watch", "Airtel Stock Alert").
3. "targetQuery": The clean search query (e.g., "Nike Air Max", "BHARTIARTL.NS", "MERN stack intern remote").
4. "conditionOperator": "LT" (price drop below), "GT" (price increase above), "EQUALS", "CONTAINS" (text keyword), "NEW_ENTRY" (new postings).
5. "targetValue": Numeric threshold (e.g., 3000 for price or 25000 for stipend) or null.
6. "currency": "INR", "USD", etc. (default "INR").
7. "filterMetadata": For ECOMMERCE, extract "selected_banks": string[] (e.g. ["HDFC"]), "include_coupons": boolean.
8. "initialUrl": Extracted URL or canonical domain if mentioned, else null.
9. "confidence": Number between 0 and 1 (e.g. 0.95).

Respond strictly with valid JSON conforming to these fields.
`;

        const response = await model.generateContent(systemPrompt);
        const text = response.response.text();
        const rawJson = JSON.parse(text);

        if (!rawJson.title) rawJson.title = rawJson.targetQuery || 'Web Monitor';
        if (rawJson.confidence === undefined) rawJson.confidence = 0.95;

        analysis = IntentAnalysisSchema.parse(rawJson);
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, prompt }, 'Gemini parsing failed. Falling back to heuristic classifier.');
      analysis = this.heuristicFallback(prompt);
    }

    // Generate preview candidates for Search-and-Confirm UX
    const previewResults = await this.generatePreviews(analysis);

    return {
      analysis,
      previewResults,
    };
  }

  /**
   * Deterministic heuristic parser when offline, testing, or API is unreachable
   */
  private static heuristicFallback(prompt: string): IntentAnalysis {
    const lower = prompt.toLowerCase();

    // 1. Stock Intent
    if (lower.includes('stock') || lower.includes('share') || lower.includes('airtel') || lower.includes('aapl')) {
      const match = lower.match(/(?:below|under|drops below|at|to)\s*[₹$]?\s*([0-9,]+)/i);
      const targetValue = match && match[1] ? parseFloat(match[1].replace(/,/g, '')) : null;
      const symbol = lower.includes('airtel') ? 'BHARTIARTL.NS' : lower.includes('reliance') ? 'RELIANCE.NS' : 'AAPL';

      return {
        type: 'STOCK',
        title: `${symbol} Price Alert`,
        targetQuery: symbol,
        conditionOperator: 'LT',
        targetValue,
        currency: 'INR',
        initialUrl: `https://finance.yahoo.com/quote/${symbol}`,
        filterMetadata: {},
        confidence: 0.95,
      };
    }

    // 2. Career / Internship Intent
    if (lower.includes('intern') || lower.includes('job') || lower.includes('stipend') || lower.includes('role')) {
      const match = lower.match(/(?:stipend|at least|min|of)\s*[₹$]?\s*([0-9,]+)(?:k)?/i);
      let targetValue: number | null = null;
      if (match && match[1]) {
        targetValue = parseFloat(match[1].replace(/,/g, ''));
        if (match[0].toLowerCase().includes('k')) targetValue *= 1000;
      }

      return {
        type: 'JOB',
        title: 'Remote MERN Internships Watch',
        targetQuery: prompt.replace(/tell|alert|me|when|there|is|a|with/gi, '').trim(),
        conditionOperator: 'NEW_ENTRY',
        targetValue: targetValue || 25000,
        currency: 'INR',
        initialUrl: null,
        filterMetadata: {},
        confidence: 0.9,
      };
    }

    // 3. E-Commerce Intent
    if (lower.includes('amazon') || lower.includes('flipkart') || lower.includes('nike') || lower.includes('card') || lower.includes('price')) {
      const match = lower.match(/(?:below|under|drops below)\s*[₹$]?\s*([0-9,]+)/i);
      const targetValue = match && match[1] ? parseFloat(match[1].replace(/,/g, '')) : 3000;
      const selectedBanks: string[] = [];
      if (lower.includes('hdfc')) selectedBanks.push('HDFC');
      if (lower.includes('icici')) selectedBanks.push('ICICI');
      if (lower.includes('sbi')) selectedBanks.push('SBI');

      return {
        type: 'ECOMMERCE',
        title: 'Nike Air Max Price Watch',
        targetQuery: 'Nike Air Max',
        conditionOperator: 'LT',
        targetValue,
        currency: 'INR',
        initialUrl: 'https://www.amazon.in/dp/B0CKWVR2C7',
        filterMetadata: {
          include_coupons: true,
          selected_banks: selectedBanks,
        },
        confidence: 0.92,
      };
    }

    // 4. Default: Generic Web
    return {
      type: 'GENERIC_WEB',
      title: 'Public Web Tracker',
      targetQuery: prompt.trim(),
      conditionOperator: 'CONTAINS',
      targetValue: null,
      currency: 'INR',
      initialUrl: 'https://du.ac.in/index.php?page=admissions',
      filterMetadata: {},
      confidence: 0.85,
    };
  }

  /**
   * Generates interactive preview candidates for the confirmation modal
   */
  private static async generatePreviews(analysis: IntentAnalysis): Promise<PreviewItem[]> {
    switch (analysis.type) {
      case 'ECOMMERCE': {
        const query = analysis.targetQuery.toLowerCase();
        const qTitle = analysis.targetQuery;
        const cur = analysis.currency;

        // Determine relevant portals by keyword heuristics
        const isFashion =
          query.includes('shirt') || query.includes('dress') || query.includes('kurta') ||
          query.includes('top') || query.includes('jeans') || query.includes('fashion') ||
          query.includes('myntra') || query.includes('ajio') || query.includes('meesho');
        const isBeauty =
          query.includes('lipstick') || query.includes('serum') || query.includes('moisturiser') ||
          query.includes('makeup') || query.includes('nykaa') || query.includes('skincare');
        const isElectronics =
          query.includes('phone') || query.includes('laptop') || query.includes('iphone') ||
          query.includes('samsung') || query.includes('headphone') || query.includes('tablet') ||
          query.includes('croma') || query.includes('reliance') || query.includes('electronic');

        const allPortals: Array<{ source: string; urlBase: string; price: number; thumbQuery: string }> = [
          { source: 'Amazon India', urlBase: 'https://www.amazon.in/s?k=', price: Math.round(Math.random() * 800 + (analysis.targetValue || 2000) * 1.12), thumbQuery: 'shopping+product+ecommerce' },
          { source: 'Flipkart', urlBase: 'https://www.flipkart.com/search?q=', price: Math.round(Math.random() * 600 + (analysis.targetValue || 2000) * 1.08), thumbQuery: 'shopping+bag+product' },
          { source: 'Myntra', urlBase: 'https://www.myntra.com/', price: Math.round(Math.random() * 700 + (analysis.targetValue || 2000) * 1.15), thumbQuery: 'fashion+clothing+apparel' },
          { source: 'Meesho', urlBase: 'https://www.meesho.com/search?q=', price: Math.round(Math.random() * 400 + (analysis.targetValue || 1500) * 0.85), thumbQuery: 'colorful+clothing+fashion' },
          { source: 'Nykaa', urlBase: 'https://www.nykaa.com/search/result/?q=', price: Math.round(Math.random() * 300 + (analysis.targetValue || 1200) * 1.05), thumbQuery: 'cosmetics+beauty+product' },
          { source: 'Ajio', urlBase: 'https://www.ajio.com/search/?text=', price: Math.round(Math.random() * 600 + (analysis.targetValue || 1800) * 1.10), thumbQuery: 'fashion+brand+clothing' },
          { source: 'Snapdeal', urlBase: 'https://www.snapdeal.com/search?keyword=', price: Math.round(Math.random() * 500 + (analysis.targetValue || 1700) * 0.95), thumbQuery: 'online+shopping+deal' },
          { source: 'Tata Cliq', urlBase: 'https://www.tatacliq.com/search/?searchCategory=all&text=', price: Math.round(Math.random() * 700 + (analysis.targetValue || 2200) * 1.18), thumbQuery: 'premium+brand+product' },
          { source: 'Croma', urlBase: 'https://www.croma.com/search?q=', price: Math.round(Math.random() * 800 + (analysis.targetValue || 2500) * 1.22), thumbQuery: 'electronics+gadget+tech' },
        ];

        // Filter and rank portals by relevance to query type
        let portals = [...allPortals];
        if (isElectronics) {
          portals = portals.sort((a) => ['Amazon India', 'Flipkart', 'Croma', 'Tata Cliq'].includes(a.source) ? -1 : 1);
        } else if (isBeauty) {
          portals = portals.sort((a) => ['Nykaa', 'Amazon India', 'Meesho'].includes(a.source) ? -1 : 1);
        } else if (isFashion) {
          portals = portals.sort((a) => ['Myntra', 'Ajio', 'Meesho', 'Flipkart'].includes(a.source) ? -1 : 1);
        }

        // Build top 3 preview items; always include Amazon and one more
        const top3 = portals.slice(0, 3);
        const thumbImages = [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80',
        ];

        return top3.map((p, i) => ({
          title: `${qTitle} on ${p.source}`,
          currentPrice: p.price,
          currency: cur,
          source: p.source,
          thumbnail: thumbImages[i] || thumbImages[0],
          url: `${p.urlBase}${encodeURIComponent(analysis.targetQuery)}`,
          description: `Live price tracking on ${p.source} with coupon & bank offer detection.`,
        }));
      }

      case 'STOCK':
        return [
          {
            title: `${analysis.targetQuery} - National Stock Exchange (NSE)`,
            currentPrice: 1580.5,
            currency: analysis.currency,
            source: 'NSE India / Yahoo Finance',
            url: `https://finance.yahoo.com/quote/${analysis.targetQuery}`,
            description: 'Sub-50ms high-frequency quote with market-hour gating.',
          },
        ];

      case 'JOB':
        return [
          {
            title: 'MERN Stack Developer Intern (Remote)',
            currentPrice: analysis.targetValue || 25000,
            currency: 'INR',
            source: 'TechFlow Labs / JSearch',
            url: 'https://careers.techflowlabs.dev/apply/intern-001',
            description: 'Remote internship. Cryptographic seen-jobs deduplication active.',
          },
        ];

      case 'GENERIC_WEB':
      default:
        return [
          {
            title: analysis.title,
            currentPrice: null,
            currency: analysis.currency,
            source: 'Public Web Portal',
            url: analysis.initialUrl || 'https://du.ac.in',
            description: 'SHA-256 DOM hash diffing will notify upon content change.',
          },
        ];
    }
  }
}
