import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getDb, closeDb } from './index';
import { logger } from '../utils/logger';
import * as path from 'path';

export async function runMigrations() {
  try {
    logger.info('Running database migrations...');
    const db = getDb();
    const migrationsFolder = path.resolve(__dirname, '../../drizzle');
    await migrate(db, { migrationsFolder });
    logger.info('Database migrations applied successfully!');
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    throw err;
  } finally {
    await closeDb();
  }
}

if (require.main === module || process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
