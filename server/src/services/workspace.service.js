import workspaceRepository from '../repositories/workspace.repository.js';
import userRepository from '../repositories/user.repository.js';
import { runInTransaction, acquireAdvisoryLock } from '../database/transaction.util.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../utils/api-error.util.js';

/**
 * WorkspaceService
 * Implements business logic for workspace lifecycle and membership management.
 */
export class WorkspaceService {
  constructor(workspaceRepo = workspaceRepository, userRepo = userRepository) {
    this.workspaceRepo = workspaceRepo;
    this.userRepo = userRepo;
  }

  /**
   * Generates a unique, URL-safe slug for a workspace.
   */
  async generateUniqueSlug(name, tx = null) {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'workspace';

    for (let attempt = 0; attempt < 5; attempt++) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const candidateSlug = `${base}-${randomSuffix}`;
      const existing = await this.workspaceRepo.findBySlug(candidateSlug, tx);
      if (!existing) {
        return candidateSlug;
      }
    }

    return `${base}-${Date.now()}`;
  }

  /**
   * Creates a new workspace, registers the creator as Owner, and updates user active workspace.
   */
  async createWorkspace(userId, { name, description = '', color = '#5757d9' }) {
    const slug = await this.generateUniqueSlug(name);

    const { workspace } = await runInTransaction(async (tx) => {
      const created = await this.workspaceRepo.createWorkspaceWithMember(
        {
          name: name.trim(),
          slug,
          description: description ? description.trim() : '',
          color,
        },
        userId,
        tx
      );

      // Set user's currentWorkspaceId to the newly created workspace
      await this.userRepo.updateById(userId, { currentWorkspaceId: created.id }, tx);

      return { workspace: created };
    });

    return {
      id: workspace.id,
      _id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      color: workspace.color,
      inviteCode: workspace.inviteCode,
      ownerId: workspace.ownerId,
      isOwner: true,
      role: 'Owner',
      membersCount: 1,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  /**
   * Lists all workspaces in which the user is a member.
   */
  async getUserWorkspaces(userId) {
    const rawWorkspaces = await this.workspaceRepo.listUserWorkspaces(userId);

    return rawWorkspaces.map((w) => {
      const membership = w.members && w.members[0];
      return {
        id: w.id,
        _id: w.id,
        name: w.name,
        slug: w.slug,
        description: w.description,
        color: w.color,
        inviteCode: w.inviteCode,
        ownerId: w.ownerId,
        isOwner: w.ownerId === userId,
        role: membership ? membership.role : 'Member',
        membersCount: w._count?.members || 1,
        projectsCount: w._count?.projects || 0,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      };
    });
  }

  /**
   * Retrieves full details for a workspace including member roster with profiles.
   */
  async getWorkspaceById(workspaceId, userId) {
    const membership = await this.workspaceRepo.getMember(workspaceId, userId);
    if (!membership) {
      const workspaceExists = await this.workspaceRepo.findById(workspaceId);
      if (!workspaceExists) {
        throw new NotFoundError('Workspace not found.');
      }
      throw new ForbiddenError('You do not have access to this workspace.');
    }

    const workspace = await this.workspaceRepo.findById(workspaceId, true);
    if (!workspace) {
      throw new NotFoundError('Workspace not found.');
    }

    const members = (workspace.members || []).map((m) => ({
      id: m.id,
      _id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: {
        id: m.user.id,
        _id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatar: m.user.avatar,
        jobTitle: m.user.jobTitle,
        isActive: m.user.isActive,
      },
    }));

    return {
      id: workspace.id,
      _id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      color: workspace.color,
      inviteCode: workspace.inviteCode,
      ownerId: workspace.ownerId,
      isOwner: workspace.ownerId === userId,
      role: membership.role,
      membersCount: workspace._count?.members || members.length,
      projectsCount: workspace._count?.projects || 0,
      members,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  /**
   * Retrieves the current active workspace for the user.
   */
  async getCurrentWorkspace(userId, activeWorkspaceId = null) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    let targetWorkspaceId = activeWorkspaceId || user.currentWorkspaceId;

    if (targetWorkspaceId) {
      const membership = await this.workspaceRepo.getMember(targetWorkspaceId, userId);
      if (membership) {
        return this.getWorkspaceById(targetWorkspaceId, userId);
      }
    }

    // Fall back to first available workspace
    const userWorkspaces = await this.getUserWorkspaces(userId);
    if (userWorkspaces.length > 0) {
      const firstWs = userWorkspaces[0];
      await this.userRepo.updateById(userId, { currentWorkspaceId: firstWs.id });
      return this.getWorkspaceById(firstWs.id, userId);
    }

    return null;
  }

  /**
   * Updates workspace settings (name, description, color). Requires Owner or Admin role.
   */
  async updateWorkspace(workspaceId, userId, { name, description, color }) {
    const membership = await this.workspaceRepo.getMember(workspaceId, userId);
    if (!membership) {
      throw new ForbiddenError('You do not have access to this workspace.');
    }

    if (membership.role !== 'Owner' && membership.role !== 'Admin') {
      throw new ForbiddenError('Only workspace Owners and Admins can update workspace settings.');
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (color !== undefined) updates.color = color;

    const updated = await this.workspaceRepo.updateWorkspace(workspaceId, updates);

    return {
      id: updated.id,
      _id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      color: updated.color,
      inviteCode: updated.inviteCode,
      ownerId: updated.ownerId,
      isOwner: updated.ownerId === userId,
      role: membership.role,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Deletes a workspace. Strictly limited to Owner.
   * Cascades related records and safely resets active workspaces for members.
   */
  async deleteWorkspace(workspaceId, userId) {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace not found.');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenError('Only the workspace owner can delete this workspace.');
    }

    await runInTransaction(async (tx) => {
      // Find fallback workspace for the owner if available
      const remainingWorkspaces = await tx.workspaceMember.findMany({
        where: {
          userId,
          workspaceId: { not: workspaceId },
        },
        select: { workspaceId: true },
      });

      const nextWorkspaceId = remainingWorkspaces.length > 0 ? remainingWorkspaces[0].workspaceId : null;

      // Update owner's active workspace
      await tx.user.update({
        where: { id: userId },
        data: { currentWorkspaceId: nextWorkspaceId },
      });

      // Delete workspace (cascades members, projects, etc.)
      await this.workspaceRepo.deleteWorkspace(workspaceId, tx);
    });

    return { success: true };
  }

  /**
   * Switches user's active workspace.
   */
  async switchWorkspace(workspaceId, userId) {
    const membership = await this.workspaceRepo.getMember(workspaceId, userId);
    if (!membership) {
      const workspaceExists = await this.workspaceRepo.findById(workspaceId);
      if (!workspaceExists) {
        throw new NotFoundError('Workspace not found.');
      }
      throw new ForbiddenError('You are not a member of this workspace.');
    }

    await this.userRepo.updateById(userId, { currentWorkspaceId: workspaceId });
    return this.getWorkspaceById(workspaceId, userId);
  }

  /**
   * Adds the user to a workspace using an invite code.
   */
  async joinWorkspaceByCode(inviteCode, userId) {
    const workspace = await this.workspaceRepo.findByInviteCode(inviteCode.trim());
    if (!workspace) {
      throw new NotFoundError('Invalid workspace invite code.');
    }

    const existingMember = await this.workspaceRepo.getMember(workspace.id, userId);
    if (existingMember) {
      throw new BadRequestError('You are already a member of this workspace.');
    }

    await runInTransaction(async (tx) => {
      await this.workspaceRepo.addMember(workspace.id, userId, 'Member', tx);
      await this.userRepo.updateById(userId, { currentWorkspaceId: workspace.id }, tx);
    });

    return this.getWorkspaceById(workspace.id, userId);
  }

  /**
   * Lists all members of a workspace. Requires workspace membership.
   */
  async listMembers(workspaceId, userId) {
    const membership = await this.workspaceRepo.getMember(workspaceId, userId);
    if (!membership) {
      const workspaceExists = await this.workspaceRepo.findById(workspaceId);
      if (!workspaceExists) {
        throw new NotFoundError('Workspace not found.');
      }
      throw new ForbiddenError('You do not have access to this workspace.');
    }

    const rawMembers = await this.workspaceRepo.listMembers(workspaceId);

    return rawMembers.map((m) => ({
      id: m.id,
      _id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: {
        id: m.user.id,
        _id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatar: m.user.avatar,
        jobTitle: m.user.jobTitle,
        isActive: m.user.isActive,
      },
    }));
  }

  /**
   * Invites or adds a registered user to the workspace. Requires Owner or Admin role.
   */
  async addMember(workspaceId, requesterId, { email, role = 'Member' }) {
    const requester = await this.workspaceRepo.getMember(workspaceId, requesterId);
    if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
      throw new ForbiddenError('Only workspace Owners and Admins can invite or add members.');
    }

    if (role === 'Owner' && requester.role !== 'Owner') {
      throw new ForbiddenError('Only a workspace Owner can assign the Owner role.');
    }

    const targetUser = await this.userRepo.findByEmail(email.toLowerCase().trim());
    if (!targetUser) {
      throw new NotFoundError(`User with email "${email}" not found. They must register an account first.`);
    }

    const existingMember = await this.workspaceRepo.getMember(workspaceId, targetUser.id);
    if (existingMember) {
      throw new BadRequestError('User is already a member of this workspace.');
    }

    const newMember = await this.workspaceRepo.addMember(workspaceId, targetUser.id, role);

    return {
      id: newMember.id,
      _id: newMember.id,
      role: newMember.role,
      joinedAt: newMember.joinedAt,
      user: {
        id: targetUser.id,
        _id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        avatar: targetUser.avatar,
        jobTitle: targetUser.jobTitle,
      },
    };
  }

  /**
   * Updates an existing member's role.
   * Safeguards against demoting the last owner and enforces role hierarchy with advisory locking.
   */
  async updateMemberRole(workspaceId, requesterId, targetUserId, newRole) {
    const requester = await this.workspaceRepo.getMember(workspaceId, requesterId);
    if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
      throw new ForbiddenError('Only workspace Owners and Admins can update member roles.');
    }

    // Protection: Admins cannot promote anyone to Owner
    if (newRole === 'Owner' && requester.role !== 'Owner') {
      throw new ForbiddenError('Only a workspace Owner can promote a member to Owner.');
    }

    const updated = await runInTransaction(async (tx) => {
      // Concurrency lock for workspace membership mutations
      await acquireAdvisoryLock(tx, `workspace:${workspaceId}:members`);

      const targetMember = await this.workspaceRepo.getMember(workspaceId, targetUserId, tx);
      if (!targetMember) {
        throw new NotFoundError('Member not found in this workspace.');
      }

      // Protection: Admins cannot modify an Owner
      if (targetMember.role === 'Owner' && requester.role !== 'Owner') {
        throw new ForbiddenError('Only a workspace Owner can modify another Owner.');
      }

      // Last-Owner Guard: If target is Owner and new role is not Owner, check remaining owners
      if (targetMember.role === 'Owner' && newRole !== 'Owner') {
        const ownerCount = await this.workspaceRepo.countOwners(workspaceId, tx);
        if (ownerCount <= 1) {
          throw new BadRequestError('Cannot demote the last owner. Please designate another owner first.');
        }
      }

      return this.workspaceRepo.updateMemberRole(workspaceId, targetUserId, newRole, tx);
    });

    return {
      id: updated.id,
      _id: updated.id,
      role: updated.role,
      joinedAt: updated.joinedAt,
      user: {
        id: updated.user.id,
        _id: updated.user.id,
        name: updated.user.name,
        email: updated.user.email,
        avatar: updated.user.avatar,
        jobTitle: updated.user.jobTitle,
      },
    };
  }

  /**
   * Removes a member from the workspace.
   * Enforces role hierarchy and last-owner protection with advisory locking.
   */
  async removeMember(workspaceId, requesterId, targetUserId) {
    const requester = await this.workspaceRepo.getMember(workspaceId, requesterId);
    if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
      throw new ForbiddenError('Only workspace Owners and Admins can remove members.');
    }

    if (requesterId === targetUserId) {
      throw new BadRequestError('To leave the workspace, please use the leave workspace option.');
    }

    await runInTransaction(async (tx) => {
      // Concurrency lock for workspace membership mutations
      await acquireAdvisoryLock(tx, `workspace:${workspaceId}:members`);

      const targetMember = await this.workspaceRepo.getMember(workspaceId, targetUserId, tx);
      if (!targetMember) {
        throw new NotFoundError('Member not found in this workspace.');
      }

      if (targetMember.role === 'Owner') {
        if (requester.role !== 'Owner') {
          throw new ForbiddenError('Admins cannot remove a workspace Owner.');
        }
        const ownerCount = await this.workspaceRepo.countOwners(workspaceId, tx);
        if (ownerCount <= 1) {
          throw new BadRequestError('Cannot remove the last owner. Please transfer ownership or delete the workspace.');
        }
      }

      await this.workspaceRepo.removeMember(workspaceId, targetUserId, tx);

      // If removed member had this workspace active, reassign or reset
      const targetUser = await this.userRepo.findById(targetUserId, {}, tx);
      if (targetUser && targetUser.currentWorkspaceId === workspaceId) {
        const remainingWorkspaces = await this.workspaceRepo.listUserWorkspaces(targetUserId, tx);
        const nextId = remainingWorkspaces.length > 0 ? remainingWorkspaces[0].id : null;
        await this.userRepo.updateById(targetUserId, { currentWorkspaceId: nextId }, tx);
      }
    });

    return { success: true };
  }

  /**
   * Leaves a workspace. Last owner cannot leave without transferring ownership first.
   */
  async leaveWorkspace(workspaceId, userId) {
    await runInTransaction(async (tx) => {
      // Concurrency lock for workspace membership mutations
      await acquireAdvisoryLock(tx, `workspace:${workspaceId}:members`);

      const member = await this.workspaceRepo.getMember(workspaceId, userId, tx);
      if (!member) {
        throw new NotFoundError('You are not a member of this workspace.');
      }

      if (member.role === 'Owner') {
        const ownerCount = await this.workspaceRepo.countOwners(workspaceId, tx);
        if (ownerCount <= 1) {
          throw new BadRequestError(
            'You are the only Owner of this workspace. Please transfer ownership or delete the workspace before leaving.'
          );
        }
      }

      await this.workspaceRepo.removeMember(workspaceId, userId, tx);

      const user = await this.userRepo.findById(userId, {}, tx);
      if (user && user.currentWorkspaceId === workspaceId) {
        const remainingWorkspaces = await this.workspaceRepo.listUserWorkspaces(userId, tx);
        const nextId = remainingWorkspaces.length > 0 ? remainingWorkspaces[0].id : null;
        await this.userRepo.updateById(userId, { currentWorkspaceId: nextId }, tx);
      }
    });

    return { success: true };
  }

  /**
   * Transfers primary ownership of a workspace to another existing member.
   */
  async transferOwnership(workspaceId, currentOwnerId, newOwnerId) {
    if (currentOwnerId === newOwnerId) {
      throw new BadRequestError('You are already the owner of this workspace.');
    }

    await runInTransaction(async (tx) => {
      await acquireAdvisoryLock(tx, `workspace:${workspaceId}:members`);

      const workspace = await this.workspaceRepo.findById(workspaceId, false, tx);
      if (!workspace) {
        throw new NotFoundError('Workspace not found.');
      }

      if (workspace.ownerId !== currentOwnerId) {
        throw new ForbiddenError('Only the primary workspace owner can transfer ownership.');
      }

      const newOwnerMember = await this.workspaceRepo.getMember(workspaceId, newOwnerId, tx);
      if (!newOwnerMember) {
        throw new BadRequestError('The designated new owner must be an active member of this workspace.');
      }

      await this.workspaceRepo.transferOwnership(workspaceId, currentOwnerId, newOwnerId, tx);
    });

    return this.getWorkspaceById(workspaceId, newOwnerId);
  }
}

export const workspaceService = new WorkspaceService();
export default workspaceService;
