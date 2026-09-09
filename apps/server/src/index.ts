import { buildServer } from './api/server';
import { env } from './config/env';
import { logger } from './utils/logger';
import { closeDb } from './db';
import { startWorkers, stopWorkers } from './workers';

async function main() {
  const server = await buildServer();

  // If START_WORKERS is set, run background worker pool in the same process
  const shouldStartWorkers = process.env.START_WORKERS === 'true';
  if (shouldStartWorkers) {
    logger.info('START_WORKERS=true: Initializing embedded BullMQ workers alongside Fastify API...');
    startWorkers();
  }

  try {
    const address = await server.listen({
      port: env.PORT,
      host: env.HOST,
    });
    logger.info(`OmniSentinel API Server listening at ${address}`);
  } catch (err) {
    logger.fatal({ err }, 'Failed to start Fastify server');
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      if (shouldStartWorkers) {
        await stopWorkers();
      }
      await server.close();
      await closeDb();
      logger.info('All connections closed cleanly. Exiting.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
