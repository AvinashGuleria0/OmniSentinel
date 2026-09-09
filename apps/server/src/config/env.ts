import dotenv from 'dotenv';
import { z } from 'zod';

import path from 'path';

// Search multiple possible locations for .env to ensure it loads regardless of run context
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MOCK_MODE: z
    .string()
    .optional()
    .transform((val) => val === undefined || val === 'true' || val === '1'),
  PORT: z
    .string()
    .optional()
    .default('4000')
    .transform((val) => parseInt(val, 10)),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().optional().default('postgresql://postgres:postgres@localhost:5432/omnisentinel'),
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),
  GEMINI_API_KEY: z.string().optional().default(''),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  BREVO_API_KEY: z.string().optional().default(''),
  BREVO_SENDER_EMAIL: z.string().optional().default('alerts@omnisentinel.dev'),
  BREVO_SENDER_NAME: z.string().optional().default('OmniSentinel Alerts'),
  RAPIDAPI_KEY: z.string().optional().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
