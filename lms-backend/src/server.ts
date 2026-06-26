import { createApp } from './app';
import { connectDb, disconnectDb } from './db/connect';
import { config } from './config';
import { logger } from './lib/logger';

async function main() {
  await connectDb();
  const app = createApp();
  const server = app.listen(config.port, () => logger.info(`API on :${config.port}`));

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
