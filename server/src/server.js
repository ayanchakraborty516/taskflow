import http from 'http';
import app from './app.js';
import env from './config/env.config.js';
import logger from './utils/logger.util.js';
import { initSocketServer, getIO } from './sockets/socket.server.js';
import { disconnectDatabase } from './database/prisma.client.js';

const httpServer = http.createServer(app);

// Initialize real-time Socket.IO server
initSocketServer(httpServer);

const PORT = env.PORT || 5000;

const server = httpServer.listen(PORT, () => {
  logger.info(`TaskFlow Server running in ${env.NODE_ENV} mode on port ${PORT}`);
  logger.info(`API Health endpoint accessible at http://localhost:${PORT}/api/health`);
});

// Graceful shutdown management
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server stopped.');

    try {
      // Close Socket.IO connections
      try {
        const io = getIO();
        await new Promise((resolve) => io.close(resolve));
        logger.info('Socket.IO connections closed.');
      } catch (e) {
        // Socket may not have initialized
      }

      // Close database connection
      await disconnectDatabase();

      logger.info('Graceful shutdown completed successfully.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  });

  // Force close if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10 seconds. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection detected');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception detected! Exiting...');
  process.exit(1);
});

export default server;

