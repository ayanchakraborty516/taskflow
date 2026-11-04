import { BaseRepository } from './base.repository.js';
import prisma from '../database/prisma.client.js';

/**
 * WorkspaceRepository
 * Data access layer for Workspace and WorkspaceMember models.
 * Encapsulates all Prisma queries with transaction support.
 */
export class WorkspaceRepository extends BaseRepository {
  constructor(databaseClient = prisma) {
    super('workspace', databaseClient);
  }

  /**
   * Creates a workspace and registers the creator as the initial Owner in an atomic query.
   */
  async createWorkspaceWithMember(data, ownerId, tx = null) {
    const client = tx || this.db;

    return client.workspace.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || '',
        color: data.color || '#5757d9',
        inviteCode: data.inviteCode,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'Owner',
          },
        },
      },
      include: {
        members: {
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
        },
      },
    });
  }

  /**
   * Finds a workspace by ID, optionally including members and member user details.
   */
  async findById(id, includeMembers = false, tx = null) {
    if (!id) return null;
    const client = tx || this.db;

    const include = includeMembers
      ? {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                  jobTitle: true,
                  isActive: true,
                },
              },
            },
            orderBy: { joinedAt: 'asc' },
          },
          _count: {
            select: { members: true, projects: true },
          },
        }
      : {
          _count: {
            select: { members: true, projects: true },
          },
        };

    return client.workspace.findUnique({
      where: { id },
      include,
    });
  }

  /**
   * Finds a workspace by its unique URL slug.
   */
  async findBySlug(slug, tx = null) {
    if (!slug) return null;
    return this.getModel(tx).findUnique({
      where: { slug },
    });
  }

  /**
   * Finds a workspace by its unique invite code.
   */
  async findByInviteCode(inviteCode, tx = null) {
    if (!inviteCode) return null;
    return this.getModel(tx).findUnique({
      where: { inviteCode },
    });
  }

  /**
   * Lists all workspaces where the given user is an active member.
   */
  async listUserWorkspaces(userId, tx = null) {
    if (!userId) return [];
    const client = tx || this.db;

    return client.workspace.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: { members: true, projects: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Updates workspace details.
   */
  async updateWorkspace(id, data, tx = null) {
    return this.getModel(tx).update({
      where: { id },
      data,
    });
  }

  /**
   * Deletes a workspace by ID (cascades members, projects, etc.).
   */
  async deleteWorkspace(id, tx = null) {
    return this.getModel(tx).delete({
      where: { id },
    });
  }

  /**
   * Retrieves a specific workspace membership record.
   */
  async getMember(workspaceId, userId, tx = null) {
    if (!workspaceId || !userId) return null;
    const client = tx || this.db;

    return client.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        workspace: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            jobTitle: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Lists all members of a workspace with user profile information.
   */
  async listMembers(workspaceId, tx = null) {
    if (!workspaceId) return [];
    const client = tx || this.db;

    return client.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            jobTitle: true,
            isActive: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /**
   * Adds a new member to a workspace.
   */
  async addMember(workspaceId, userId, role = 'Member', tx = null) {
    const client = tx || this.db;

    return client.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role,
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
   * Updates an existing member's role in a workspace.
   */
  async updateMemberRole(workspaceId, userId, role, tx = null) {
    const client = tx || this.db;

    return client.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: { role },
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
   * Removes a member from a workspace.
   */
  async removeMember(workspaceId, userId, tx = null) {
    const client = tx || this.db;

    return client.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
  }

  /**
   * Counts the number of owners in a workspace.
   */
  async countOwners(workspaceId, tx = null) {
    const client = tx || this.db;

    return client.workspaceMember.count({
      where: {
        workspaceId,
        role: 'Owner',
      },
    });
  }

  /**
   * Counts the total members in a workspace.
   */
  async countMembers(workspaceId, tx = null) {
    const client = tx || this.db;

    return client.workspaceMember.count({
      where: { workspaceId },
    });
  }

  /**
   * Transfers workspace ownership to a new user and updates membership roles.
   */
  async transferOwnership(workspaceId, currentOwnerId, newOwnerId, tx = null) {
    const client = tx || this.db;

    const updatedWorkspace = await client.workspace.update({
      where: { id: workspaceId },
      data: { ownerId: newOwnerId },
    });

    await client.workspaceMember.update({
      where: {
        workspaceId_userId: { workspaceId, userId: newOwnerId },
      },
      data: { role: 'Owner' },
    });

    await client.workspaceMember.update({
      where: {
        workspaceId_userId: { workspaceId, userId: currentOwnerId },
      },
      data: { role: 'Admin' },
    });

    return updatedWorkspace;
  }
}

export const workspaceRepository = new WorkspaceRepository();
export default workspaceRepository;
