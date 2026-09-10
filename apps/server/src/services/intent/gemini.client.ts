import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

let genAIInstance: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAIInstance) {
    if (!env.GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY is not set. Operating in mock AI mode.');
    }
    genAIInstance = new GoogleGenerativeAI(env.GEMINI_API_KEY || 'mock_key');
  }
  return genAIInstance;
}

export function getGeminiFlashModel(enforceJson = true, modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash') {
  const client = getGeminiClient();
  return client.getGenerativeModel({
    model: modelName,
    generationConfig: enforceJson ? { responseMimeType: 'application/json' } : undefined,
  });
}



