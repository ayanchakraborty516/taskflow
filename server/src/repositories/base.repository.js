import prisma from '../database/prisma.client.js';

/**
 * Base repository providing core query execution patterns and dependency injection.
 * Enforces that all database access passes through Prisma delegates without leaking SQL into services.
 */
export class BaseRepository {
  /**
   * @param {string} modelName - Model name on PrismaClient (e.g. 'user', 'workspace', 'task')
   * @param {Object} databaseClient - PrismaClient instance (default: prisma singleton)
   */
  constructor(modelName, databaseClient = prisma) {
    if (!modelName) {
      throw new Error('BaseRepository requires a valid Prisma model name.');
    }
    this.modelName = modelName;
    this.db = databaseClient;
  }

  /**
   * Returns the Prisma model delegate for the given transactional context or root client.
   *
   * @param {Object} [tx] - Optional transactional client
   * @returns {Object} Prisma model delegate
   */
  getModel(tx = null) {
    const client = tx || this.db;
    const model = client[this.modelName];
    if (!model) {
      throw new Error(`Prisma model '${this.modelName}' not found on client.`);
    }
    return model;
  }

  /**
   * Finds a unique record by primary key `id`.
   */
  async findById(id, options = {}, tx = null) {
    return this.getModel(tx).findUnique({
      where: { id },
      ...options,
    });
  }

  /**
   * Counts records matching a filter.
   */
  async count(where = {}, tx = null) {
    return this.getModel(tx).count({ where });
  }

  /**
   * Deletes a record by primary key `id`.
   */
  async deleteById(id, tx = null) {
    return this.getModel(tx).delete({
      where: { id },
    });
  }
}

export default BaseRepository;

