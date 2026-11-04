import { BaseRepository } from './base.repository.js';
import prisma from '../database/prisma.client.js';

export const projectInclude = {
  lead: {
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      jobTitle: true,
    },
  },
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
    orderBy: { createdAt: 'asc' },
  },
  tasks: {
    select: {
      id: true,
      status: true,
    },
  },
};

/**
 * Calculates project milestone statistics from associated tasks.
 */
export const calculateProjectStats = (tasks = []) => {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const inReview = tasks.filter((t) => t.status === 'in_review').length;
  const todo = tasks.filter((t) => t.status === 'todo').length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    total,
    done,
    inProgress,
    inReview,
    todo,
    completionRate,
  };
};

/**
 * Formats a project entity with stats and serialized member profiles.
 */
export const formatProject = (project) => {
  if (!project) return null;
  const stats = calculateProjectStats(project.tasks || []);

  const formattedMembers = (project.members || []).map((m) => ({
    id: m.id,
    _id: m.id,
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

  const { tasks, ...rest } = project;

  return {
    ...rest,
    id: project.id,
    _id: project.id,
    lead: project.lead
      ? {
          id: project.lead.id,
          _id: project.lead.id,
          name: project.lead.name,
          email: project.lead.email,
          avatar: project.lead.avatar,
          jobTitle: project.lead.jobTitle,
        }
      : null,
    members: formattedMembers,
    stats,
  };
};

/**
 * ProjectRepository
 * Encapsulates Prisma data access for Project entities.
 */
export class ProjectRepository extends BaseRepository {
  constructor(databaseClient = prisma) {
    super('project', databaseClient);
  }

  /**
   * Creates a new project in the database.
   */
  async create(data, tx = null) {
    const client = tx || this.db;
    return client.project.create({
      data,
      include: projectInclude,
    });
  }

  /**
   * Finds a project by ID strictly scoped to a workspace.
   */
  async findById(id, workspaceId, tx = null) {
    if (!id || !workspaceId) return null;
    const client = tx || this.db;

    return client.project.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: projectInclude,
    });
  }

  /**
   * Finds a project by key strictly scoped to a workspace.
   */
  async findByKey(key, workspaceId, tx = null) {
    if (!key || !workspaceId) return null;
    const client = tx || this.db;

    return client.project.findFirst({
      where: {
        key: key.toUpperCase(),
        workspaceId,
      },
      include: projectInclude,
    });
  }

  /**
   * Lists projects within a workspace with optional filters (search, status, category, isStarred).
   */
  async listProjects({ workspaceId, search, status, category, isStarred }, tx = null) {
    if (!workspaceId) return [];
    const client = tx || this.db;

    const where = {
      workspaceId,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (category && category !== 'all') {
      where.category = category;
    }

    if (typeof isStarred === 'boolean') {
      where.isStarred = isStarred;
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { key: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    return client.project.findMany({
      where,
      include: projectInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Updates a project scoped to a workspace.
   */
  async update(id, workspaceId, data, tx = null) {
    const client = tx || this.db;

    return client.project.update({
      where: { id },
      data,
      include: projectInclude,
    });
  }

  /**
   * Deletes a project by ID (cascades tasks, members, activities).
   */
  async delete(id, workspaceId, tx = null) {
    const client = tx || this.db;

    return client.project.delete({
      where: { id },
    });
  }

  /**
   * Counts projects inside a workspace.
   */
  async countProjects(workspaceId, tx = null) {
    const client = tx || this.db;
    return client.project.count({
      where: { workspaceId },
    });
  }
}

export const projectRepository = new ProjectRepository();
export default projectRepository;
