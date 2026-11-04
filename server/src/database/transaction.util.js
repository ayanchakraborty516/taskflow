import prisma, { getPrismaClient } from './prisma.client.js';
import logger from '../utils/logger.util.js';

/**
 * Executes a callback within a managed Prisma database transaction.
 * Automatically retries on concurrency deadlocks (40P01) and serialization conflicts (40001).
 *
 * @param {Function} operation - Async function receiving `tx` (Prisma transactional client)
 * @param {Object} options - Prisma transaction options (maxWait, timeout, isolationLevel)
 * @param {number} maxRetries - Maximum retry attempts before bubbling up failure (default: 3)
 * @returns {Promise<any>} Result of the operation
 */
export const runInTransaction = async (operation, options = {}, maxRetries = 3) => {
  let attempt = 0;
  const client = getPrismaClient();

  while (attempt < maxRetries) {
    try {
      return await client.$transaction(async (tx) => {
        return await operation(tx);
      }, options);
    } catch (error) {
      attempt++;
      // Check for PostgreSQL 40P01 (deadlock), 40001 (serialization failure), or Prisma P2034
      const isDeadlockOrSerialization =
        error.code === 'P2034' ||
        error.message?.includes('40P01') ||
        error.message?.includes('40001') ||
        error.message?.includes('deadlock detected') ||
        error.message?.includes('could not serialize access');

      if (isDeadlockOrSerialization && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 25 + Math.floor(Math.random() * 50);
        logger.warn(
          { attempt, maxRetries, backoffMs, errCode: error.code },
          'Transaction concurrency failure; retrying with exponential backoff...'
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      throw error;
    }
  }
};

/**
 * Acquires a transaction-scoped PostgreSQL advisory lock using an MD5-hashed 64-bit integer key.
 * The lock is automatically released by PostgreSQL when the transaction commits or aborts.
 *
 * @param {Object} tx - Active transactional Prisma client
 * @param {string} lockKey - Logical string identifier (e.g. `workspace:${wsId}:task-reorder`)
 */
export const acquireAdvisoryLock = async (tx, lockKey) => {
  if (!tx || typeof tx.$executeRaw !== 'function') {
    throw new Error('acquireAdvisoryLock requires an active Prisma transactional client.');
  }

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      ('x' || substr(md5(${lockKey}), 1, 16))::bit(64)::bigint
    )
  `;
};

/**
 * Helper to ensure an operation executes with a database client:
 * If an active transaction `tx` is provided, it uses it directly; otherwise it uses the root Prisma client.
 *
 * @param {Object|null} tx - Optional active transaction client
 * @param {Object} fallbackClient - Client to use if tx is absent (defaults to singleton prisma)
 * @returns {Object} Database client to execute queries against
 */
export const getClient = (tx, fallbackClient = prisma) => {
  return tx || fallbackClient;
};

export default {
  runInTransaction,
  acquireAdvisoryLock,
  getClient,
};
