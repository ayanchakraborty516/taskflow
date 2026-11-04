import { BaseRepository } from './base.repository.js';
import prisma from '../database/prisma.client.js';

export class UserRepository extends BaseRepository {
  constructor(databaseClient = prisma) {
    super('user', databaseClient);
  }

  /**
   * Finds a user by normalized lowercase email address.
   */
  async findByEmail(email, options = {}, tx = null) {
    if (!email) return null;
    return this.getModel(tx).findUnique({
      where: { email: email.toLowerCase().trim() },
      ...options,
    });
  }

  /**
   * Finds a user by primary key ID.
   */
  async findById(id, options = {}, tx = null) {
    if (!id) return null;
    return this.getModel(tx).findUnique({
      where: { id },
      ...options,
    });
  }

  /**
   * Creates a new user record.
   */
  async create(userData, tx = null) {
    return this.getModel(tx).create({
      data: userData,
    });
  }

  /**
   * Updates an existing user record by ID.
   */
  async updateById(id, data, tx = null) {
    return this.getModel(tx).update({
      where: { id },
      data,
    });
  }

  /**
   * Retrieves all workspaces in which the user is an active member.
   */
  async findUserWorkspaces(userId, tx = null) {
    const client = tx || this.db;
    return client.workspace.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        ownerId: true,
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Searches and lists users, optionally filtered by workspace membership.
   */
  async findUsers({ search, workspaceId }, tx = null) {
    const client = tx || this.db;
    const where = {
      isActive: true,
    };

    if (workspaceId) {
      where.workspaceMemberships = {
        some: { workspaceId },
      };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    return client.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        jobTitle: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}

export const userRepository = new UserRepository();
export default userRepository;
