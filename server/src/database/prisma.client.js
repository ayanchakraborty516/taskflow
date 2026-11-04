import { PrismaClient } from '@prisma/client';
import env from '../config/env.config.js';
import logger from '../utils/logger.util.js';

let prismaInstance = null;

/**
 * Creates or retrieves the singleton PrismaClient instance.
 */
export const getPrismaClient = () => {
  if (!prismaInstance) {
    const isDev = env.NODE_ENV === 'development';
    const isTest = env.NODE_ENV === 'test';

    prismaInstance = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL || env.DATABASE_URL,
      log: isDev
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : isTest
        ? []
        : [{ emit: 'stdout', level: 'error' }, { emit: 'stdout', level: 'warn' }],
    });

    if (isDev) {
      prismaInstance.$on('query', (e) => {
        logger.debug({ query: e.query, params: e.params, duration: `${e.duration}ms` }, 'Prisma Query');
      });
    }
  }

  return prismaInstance;
};

export const prisma = getPrismaClient();

/**
 * Explicitly connects to PostgreSQL and verifies connectivity.
 */
export const connectDatabase = async () => {
  const start = Date.now();
  const client = getPrismaClient();
  await client.$connect();
  const latencyMs = Date.now() - start;
  logger.info({ latencyMs }, 'Database connected successfully.');
  return { connected: true, latencyMs };
};

/**
 * Performs a lightweight health check against the PostgreSQL database.
 */
export const checkDatabaseHealth = async () => {
  const start = Date.now();
  try {
    const client = getPrismaClient();
    const result = await client.$queryRaw`SELECT 1 as healthy, current_database() as database, version() as version;`;
    const latencyMs = Date.now() - start;

    const row = Array.isArray(result) && result[0] ? result[0] : {};
    return {
      status: 'healthy',
      database: row.database || 'unknown',
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    logger.error({ err, latencyMs }, 'Database health check failed');
    return {
      status: 'unhealthy',
      error: err.message,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Gracefully disconnects PrismaClient from PostgreSQL.
 */
export const disconnectDatabase = async () => {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    logger.info('Database connection closed.');
  }
};

export default prisma;
