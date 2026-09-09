import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let redisInstance: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisInstance) {
    const redisUrl = env.REDIS_URL || 'redis://localhost:6379';
    logger.info({ redisUrl: redisUrl.replace(/:[^:@]+@/, ':***@') }, 'Initializing Redis connection...');

    const isUpstash = redisUrl.includes('upstash.io');
    const options: any = {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    };

    if (isUpstash || redisUrl.startsWith('rediss://')) {
      options.tls = {};
    }

    redisInstance = new Redis(redisUrl, options);

    redisInstance.on('connect', () => {
      logger.info('Connected to Redis broker');
    });

    redisInstance.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis connection warning');
    });
  }

  return redisInstance;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    logger.info('Redis connection closed');
  }
}
