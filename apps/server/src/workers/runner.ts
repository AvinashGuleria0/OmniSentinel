import { startWorkers, stopWorkers } from './index';
import { logger } from '../utils/logger';

logger.info('Booting standalone OmniSentinel worker pool...');
startWorkers();

process.on('SIGINT', async () => {
  logger.info('Caught SIGINT. Gracefully stopping workers...');
  await stopWorkers();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Caught SIGTERM. Gracefully stopping workers...');
  await stopWorkers();
  process.exit(0);
});
