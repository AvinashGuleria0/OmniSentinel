import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let client: postgres.Sql | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured in environment variables');
    }

    try {
      client = postgres(env.DATABASE_URL, {
        max: 10,
        idle_timeout: 30,
        connect_timeout: 30,
        ssl: env.DATABASE_URL.includes('supabase') ? 'require' : false,
      });

      dbInstance = drizzle(client, { schema });
      logger.info('Database connection pool initialized');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize database connection');
      throw err;
    }
  }

  return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export async function closeDb() {
  if (client) {
    await client.end();
    client = null;
    dbInstance = null;
    logger.info('Database connection pool closed');
  }
}

export * from './schema';
