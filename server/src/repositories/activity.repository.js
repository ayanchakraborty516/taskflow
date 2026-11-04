import prisma from '../database/prisma.client.js';

export const activityInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
    },
  },
  project: {
    select: {
      id: true,
      name: true,
      key: true,
    },
  },
  task: {
    select: {
      id: true,
      title: true,
      key: true,
    },
  },
};

export const formatActivity = (activity) => {
  if (!activity) return null;
  return {
    ...activity,
    _id: activity.id,
    user: activity.user ? { ...activity.user, _id: activity.user.id } : null,
    project: activity.project ? { ...activity.project, _id: activity.project.id } : null,
    task: activity.task ? { ...activity.task, _id: activity.task.id } : null,
  };
};

export class ActivityRepository {
  constructor(databaseClient = prisma) {
    this.db = databaseClient;
  }

  async create({ workspaceId, userId, action, details, projectId = null, taskId = null }, tx = null) {
    const client = tx || this.db;
    const activity = await client.activity.create({
      data: {
        workspaceId,
        userId,
        action,
        details,
        projectId: projectId || null,
        taskId: taskId || null,
      },
      include: activityInclude,
    });
    return formatActivity(activity);
  }

  async listByWorkspace(workspaceId, { projectId = null, taskId = null, limit = 20 } = {}, tx = null) {
    if (!workspaceId) return [];
    const client = tx || this.db;

    const where = { workspaceId };
    if (projectId) where.projectId = projectId;
    if (taskId) where.taskId = taskId;

    const activities = await client.activity.findMany({
      where,
      include: activityInclude,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(limit) || 20, 1), 100),
    });

    return activities.map(formatActivity);
  }
}

export const activityRepository = new ActivityRepository();
export default activityRepository;
