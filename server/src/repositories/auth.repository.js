import { BaseRepository } from './base.repository.js';
import prisma from '../database/prisma.client.js';

export class AuthRepository extends BaseRepository {
  constructor(databaseClient = prisma) {
    super('refreshToken', databaseClient);
  }

  /**
   * Persists a new refresh token hash in the database.
   */
  async createRefreshToken({ token, userId, expiresAt }, tx = null) {
    return this.getModel(tx).create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
  }

  /**
   * Finds a refresh token record by its SHA-256 hash.
   */
  async findRefreshToken(token, tx = null) {
    return this.getModel(tx).findUnique({
      where: { token },
      include: {
        user: true,
      },
    });
  }

  /**
   * Marks a refresh token as revoked.
   */
  async revokeRefreshToken(id, tx = null) {
    return this.getModel(tx).update({
      where: { id },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revokes all active refresh tokens for a user (e.g. on reuse detection or security reset).
   */
  async revokeAllUserTokens(userId, tx = null) {
    return this.getModel(tx).updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Deletes expired refresh tokens from the database.
   */
  async deleteExpiredTokens(tx = null) {
    return this.getModel(tx).deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}

export const authRepository = new AuthRepository();
export default authRepository;
