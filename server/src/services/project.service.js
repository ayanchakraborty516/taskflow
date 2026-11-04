import projectRepository, { formatProject } from '../repositories/project.repository.js';
import projectMemberRepository from '../repositories/project-member.repository.js';
import workspaceRepository from '../repositories/workspace.repository.js';
import { runInTransaction, acquireAdvisoryLock } from '../database/transaction.util.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../utils/api-error.util.js';

/**
 * ProjectService
 * Implements business logic and access control for Project and ProjectMember entities.
 */
export class ProjectService {
  constructor(
    projectRepo = projectRepository,
    projectMemberRepo = projectMemberRepository,
    workspaceRepo = workspaceRepository
  ) {
    this.projectRepo = projectRepo;
    this.projectMemberRepo = projectMemberRepo;
    this.workspaceRepo = workspaceRepo;
  }

  /**
   * Generates a unique project key within a workspace if not explicitly provided.
   */
  async generateUniqueProjectKey(workspaceId, name, requestedKey = null, tx = null) {
    if (requestedKey && requestedKey.trim()) {
      const sanitized = requestedKey.trim().toUpperCase();
      const existing = await this.projectRepo.findByKey(sanitized, workspaceId, tx);
      if (existing) {
        throw new BadRequestError(`Project key "${sanitized}" is already in use in this workspace.`);
      }
      return sanitized;
    }

    // Derive a clean acronym or base from the project name
    const cleaned = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const base = (cleaned.slice(0, 3) || 'PRJ').padEnd(2, 'X');

    for (let i = 0; i < 10; i++) {
      const candidate = i === 0 ? base : `${base}${i}`;
      const existing = await this.projectRepo.findByKey(candidate, workspaceId, tx);
      if (!existing) {
        return candidate;
      }
    }

    return `${base}${Math.floor(100 + Math.random() * 900)}`;
  }

  /**
   * Creates a new project in the specified workspace.
   */
  async createProject(workspaceId, requesterId, requesterRole, data) {
    if (requesterRole === 'Viewer') {
      throw new ForbiddenError('Viewers do not have permission to create projects.');
    }

    const targetLeadId = data.leadId || data.lead || requesterId;

    // Validate that project lead is an active member of the workspace
    if (targetLeadId) {
      const leadMembership = await this.workspaceRepo.getMember(workspaceId, targetLeadId);
      if (!leadMembership) {
        throw new BadRequestError('Project lead must be an active member of this workspace.');
      }
    }

    return runInTransaction(async (tx) => {
      // Advisory lock to prevent duplicate key race conditions in the same workspace
      await acquireAdvisoryLock(tx, `workspace:${workspaceId}:projects`);

      const key = await this.generateUniqueProjectKey(workspaceId, data.name, data.key, tx);

      const membersToCreate = [{ userId: requesterId }];
      if (targetLeadId && targetLeadId !== requesterId) {
        membersToCreate.push({ userId: targetLeadId });
      }

      const created = await this.projectRepo.create(
        {
          workspaceId,
          name: data.name.trim(),
          key,
          description: data.description ? data.description.trim() : '',
          category: data.category || 'Design & Eng',
          status: data.status || 'in_progress',
          color: data.color || '#5757d9',
          icon: data.icon || 'folder',
          leadId: targetLeadId || null,
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          targetDate: data.targetDate ? new Date(data.targetDate) : null,
          isStarred: Boolean(data.isStarred),
          members: {
            create: membersToCreate,
          },
        },
        tx
      );

      return formatProject(created);
    });
  }

  /**
   * Lists projects within a workspace matching optional filter criteria.
   */
  async listProjects(workspaceId, filters = {}) {
    const rawProjects = await this.projectRepo.listProjects({ workspaceId, ...filters });
    return rawProjects.map(formatProject);
  }

  /**
   * Retrieves full details for a project scoped to a workspace.
   */
  async getProjectById(projectId, workspaceId) {
    const project = await this.projectRepo.findById(projectId, workspaceId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }
    return formatProject(project);
  }

  /**
   * Updates project details.
   */
  async updateProject(projectId, workspaceId, requesterId, requesterRole, data) {
    if (requesterRole === 'Viewer') {
      throw new ForbiddenError('Viewers do not have permission to update projects.');
    }

    const existing = await this.projectRepo.findById(projectId, workspaceId);
    if (!existing) {
      throw new NotFoundError('Project not found.');
    }

    const isOwnerOrAdmin = requesterRole === 'Owner' || requesterRole === 'Admin';
    const isLead = existing.leadId === requesterId;
    const isProjectMember = (existing.members || []).some((m) => m.userId === requesterId);

    // If neither Owner/Admin nor Lead nor ProjectMember -> 403
    if (!isOwnerOrAdmin && !isLead && !isProjectMember) {
      throw new ForbiddenError('Only workspace Admins or project contributors can update this project.');
    }

    // Field-level permission enforcement:
    // 1. Changing project lead: strictly Owner or Admin
    if ((data.lead !== undefined || data.leadId !== undefined) && !isOwnerOrAdmin) {
      const requestedLead = data.leadId || data.lead;
      if (requestedLead !== existing.leadId) {
        throw new ForbiddenError('Only workspace Owners and Admins can reassign the project lead.');
      }
    }

    // 2. Changing project key: strictly Owner or Admin
    if (data.key !== undefined && data.key.trim().toUpperCase() !== existing.key && !isOwnerOrAdmin) {
      throw new ForbiddenError('Only workspace Owners and Admins can change the project key.');
    }

    // 3. Changing project settings (name, description, category, status, dates, color, icon): Owner, Admin, or Project Lead
    const hasCoreFieldUpdates =
      data.name !== undefined ||
      data.description !== undefined ||
      data.category !== undefined ||
      data.status !== undefined ||
      data.color !== undefined ||
      data.icon !== undefined ||
      data.startDate !== undefined ||
      data.targetDate !== undefined;

    if (hasCoreFieldUpdates && !isOwnerOrAdmin && !isLead) {
      throw new ForbiddenError('Only workspace Admins or the Project Lead can modify project settings.');
    }

    return runInTransaction(async (tx) => {
      const updates = {};

      if (data.name !== undefined) updates.name = data.name.trim();

      if (data.key !== undefined && data.key.trim()) {
        const sanitizedKey = data.key.trim().toUpperCase();
        if (sanitizedKey !== existing.key) {
          const keyConflict = await this.projectRepo.findByKey(sanitizedKey, workspaceId, tx);
          if (keyConflict && keyConflict.id !== projectId) {
            throw new BadRequestError(`Project key "${sanitizedKey}" is already in use in this workspace.`);
          }
          updates.key = sanitizedKey;
        }
      }

      if (data.description !== undefined) updates.description = data.description.trim();
      if (data.category !== undefined) updates.category = data.category;
      if (data.status !== undefined) updates.status = data.status;
      if (data.color !== undefined) updates.color = data.color;
      if (data.icon !== undefined) updates.icon = data.icon;

      if (data.lead !== undefined || data.leadId !== undefined) {
        const newLeadId = data.leadId || data.lead;
        if (newLeadId) {
          const leadMember = await this.workspaceRepo.getMember(workspaceId, newLeadId, tx);
          if (!leadMember) {
            throw new BadRequestError('Designated project lead must be an active member of this workspace.');
          }
          updates.leadId = newLeadId;

          // Automatically ensure lead is a member of the project
          const isLeadInProject = await this.projectMemberRepo.isMember(projectId, newLeadId, tx);
          if (!isLeadInProject) {
            await this.projectMemberRepo.addMember(workspaceId, projectId, newLeadId, tx);
          }
        } else {
          updates.leadId = null;
        }
      }

      if (data.startDate !== undefined) updates.startDate = data.startDate ? new Date(data.startDate) : new Date();
      if (data.targetDate !== undefined) updates.targetDate = data.targetDate ? new Date(data.targetDate) : null;
      if (data.isStarred !== undefined) updates.isStarred = Boolean(data.isStarred);

      const updated = await this.projectRepo.update(projectId, workspaceId, updates, tx);
      return formatProject(updated);
    });
  }

  /**
   * Deletes a project. Strictly limited to workspace Owner or Admin.
   */
  async deleteProject(projectId, workspaceId, requesterId, requesterRole) {
    if (requesterRole !== 'Owner' && requesterRole !== 'Admin') {
      throw new ForbiddenError('Only workspace Owners and Admins can delete projects.');
    }

    const project = await this.projectRepo.findById(projectId, workspaceId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    await runInTransaction(async (tx) => {
      await this.projectRepo.delete(projectId, workspaceId, tx);
    });

    return { success: true };
  }

  /**
   * Archives a project.
   */
  async archiveProject(projectId, workspaceId, requesterId, requesterRole) {
    return this.updateProject(projectId, workspaceId, requesterId, requesterRole, { status: 'archived' });
  }

  /**
   * Restores an archived project to in_progress.
   */
  async restoreProject(projectId, workspaceId, requesterId, requesterRole) {
    return this.updateProject(projectId, workspaceId, requesterId, requesterRole, { status: 'in_progress' });
  }

  /**
   * Lists all members of a project.
   */
  async listProjectMembers(projectId, workspaceId) {
    const project = await this.projectRepo.findById(projectId, workspaceId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    const members = await this.projectMemberRepo.listMembers(projectId);

    return members.map((m) => ({
      id: m.id,
      _id: m.id,
      projectId: m.projectId,
      userId: m.userId,
      name: m.user?.name,
      email: m.user?.email,
      avatar: m.user?.avatar,
      jobTitle: m.user?.jobTitle,
      user: m.user
        ? {
            id: m.user.id,
            _id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            avatar: m.user.avatar,
            jobTitle: m.user.jobTitle,
          }
        : null,
      createdAt: m.createdAt,
    }));
  }

  /**
   * Adds an active workspace member to a project.
   */
  async addProjectMember(projectId, workspaceId, requesterId, requesterRole, targetUserId) {
    if (requesterRole === 'Viewer') {
      throw new ForbiddenError('Viewers cannot manage project members.');
    }

    const project = await this.projectRepo.findById(projectId, workspaceId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    // Permission check: Owner/Admin or project lead
    if (requesterRole !== 'Owner' && requesterRole !== 'Admin' && project.leadId !== requesterId) {
      throw new ForbiddenError('Only workspace Admins or the Project Lead can add project members.');
    }

    // Enforce Tenant Boundary: Target user MUST be an active member of this workspace
    const workspaceMember = await this.workspaceRepo.getMember(workspaceId, targetUserId);
    if (!workspaceMember) {
      throw new BadRequestError('User is not a member of this workspace and cannot be added to this project.');
    }

    return runInTransaction(async (tx) => {
      // Concurrency lock for project membership mutations
      await acquireAdvisoryLock(tx, `project:${projectId}:members`);

      // Check duplicate membership
      const existingMember = await this.projectMemberRepo.findMember(projectId, targetUserId, tx);
      if (existingMember) {
        throw new BadRequestError('User is already a member of this project.');
      }

      const newMember = await this.projectMemberRepo.addMember(workspaceId, projectId, targetUserId, tx);

      return {
        id: newMember.id,
        _id: newMember.id,
        projectId: newMember.projectId,
        userId: newMember.userId,
        name: newMember.user?.name,
        email: newMember.user?.email,
        avatar: newMember.user?.avatar,
        jobTitle: newMember.user?.jobTitle,
        user: newMember.user,
        createdAt: newMember.createdAt,
      };
    });
  }

  /**
   * Removes a member from a project.
   */
  async removeProjectMember(projectId, workspaceId, requesterId, requesterRole, targetUserId) {
    if (requesterRole === 'Viewer') {
      throw new ForbiddenError('Viewers cannot manage project members.');
    }

    const project = await this.projectRepo.findById(projectId, workspaceId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    // Permission check: Owner/Admin, project lead, or self-removal
    const isSelfRemoval = requesterId === targetUserId;
    if (!isSelfRemoval && requesterRole !== 'Owner' && requesterRole !== 'Admin' && project.leadId !== requesterId) {
      throw new ForbiddenError('Permission denied to remove member from this project.');
    }

    const existingMember = await this.projectMemberRepo.findMember(projectId, targetUserId);
    if (!existingMember) {
      throw new NotFoundError('User is not a member of this project.');
    }

    await this.projectMemberRepo.removeMember(projectId, targetUserId);

    return { success: true };
  }
}

export const projectService = new ProjectService();
export default projectService;
