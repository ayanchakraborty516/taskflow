import { BaseRepository } from './base.repository.js';
import prisma from '../database/prisma.client.js';

/**
 * ProjectMemberRepository
 * Encapsulates database queries for ProjectMember entities with workspace tenant enforcement.
 */
export class ProjectMemberRepository extends BaseRepository {
  constructor(databaseClient = prisma) {
    super('projectMember', databaseClient);
  }

  /**
   * Adds a user as a member of a project, explicitly scoping the composite workspace tenant foreign key.
   */
  async addMember(workspaceId, projectId, userId, tx = null) {
    const client = tx || this.db;

    return client.projectMember.create({
      data: {
        workspaceId,
        projectId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            jobTitle: true,
          },
        },
      },
    });
  }

  /**
   * Removes a member from a project.
   */
  async removeMember(projectId, userId, tx = null) {
    const client = tx || this.db;

    return client.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
  }

  /**
   * Finds a specific project member record.
   */
  async findMember(projectId, userId, tx = null) {
    if (!projectId || !userId) return null;
    const client = tx || this.db;

    return client.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            jobTitle: true,
          },
        },
      },
    });
  }

  /**
   * Lists all members of a project.
   */
  async listMembers(projectId, tx = null) {
    const client = tx || this.db;

    return client.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            jobTitle: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Checks whether a user is an active member of a project.
   */
  async isMember(projectId, userId, tx = null) {
    const client = tx || this.db;
    const count = await client.projectMember.count({
      where: {
        projectId,
        userId,
      },
    });
    return count > 0;
  }
}

export const projectMemberRepository = new ProjectMemberRepository();
export default projectMemberRepository;
