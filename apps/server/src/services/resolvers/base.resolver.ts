import crypto from 'crypto';
import {
  ConditionOperator,
  ExecutionJobPayload,
  IResolver,
  ResolutionResult,
} from '@omnisentinel/shared';
import { logger } from '../../utils/logger';

export abstract class BaseResolver implements IResolver {
  abstract resolve(payload: ExecutionJobPayload): Promise<ResolutionResult>;

  /**
   * Evaluates deterministic condition logic in runtime TypeScript (zero AI hallucination)
   */
  protected evaluateCondition(
    operator: ConditionOperator,
    currentValue: number | null,
    targetValue: number | null
  ): boolean {
    if (operator === 'NEW_ENTRY') {
      // For jobs or new announcements, finding a non-null valid entity satisfies the condition
      return currentValue !== null;
    }

    if (currentValue === null || targetValue === null) {
      return false;
    }

    switch (operator) {
      case 'LT':
        return currentValue <= targetValue;
      case 'GT':
        return currentValue >= targetValue;
      case 'EQUALS':
        return Math.abs(currentValue - targetValue) < 0.01;
      default:
        logger.warn({ operator }, 'Unsupported numeric condition operator');
        return false;
    }
  }

  /**
   * Computes a deterministic SHA-256 hash of a string
   */
  protected computeHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Normalizes text by removing redundant whitespaces, tabs, and newlines
   */
  protected cleanText(rawText: string): string {
    return rawText
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}
