import prisma from '../database/prisma.client.js';

export class DashboardRepository {
  constructor(databaseClient = prisma) {
    this.db = databaseClient;
  }

  async getMetrics(workspaceId, userId, tx = null) {
    const client = tx || this.db;
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      activeProjectsCount,
      totalTasksCount,
      statusGroups,
      myTasksCount,
      myTasksInProgress,
      myTasksDueToday,
      overdueCount,
      completedThisWeek,
      priorityTasksRaw,
      upcomingDeadlinesRaw,
      completedLast7DaysRaw,
      activeProjectsRaw,
    ] = await Promise.all([
      // 1. Active projects count
      client.project.count({
        where: {
          workspaceId,
          status: { in: ['planning', 'in_progress'] },
        },
      }),

      // 2. Total tasks count
      client.task.count({
        where: { workspaceId },
      }),

      // 3. Status grouping
      client.task.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: { status: true },
      }),

      // 4. My tasks pending count
      userId
        ? client.task.count({
            where: {
              workspaceId,
              assigneeId: userId,
              status: { not: 'done' },
            },
          })
        : Promise.resolve(0),

      // 5. My tasks in progress
      userId
        ? client.task.count({
            where: {
              workspaceId,
              assigneeId: userId,
              status: 'in_progress',
            },
          })
        : Promise.resolve(0),

      // 6. My tasks due today
      userId
        ? client.task.count({
            where: {
              workspaceId,
              assigneeId: userId,
              status: { not: 'done' },
              dueDate: {
                gte: startOfToday,
                lte: endOfToday,
              },
            },
          })
        : Promise.resolve(0),

      // 7. Overdue tasks count
      client.task.count({
        where: {
          workspaceId,
          status: { not: 'done' },
          dueDate: { lt: now },
        },
      }),

      // 8. Completed this week
      client.task.count({
        where: {
          workspaceId,
          status: 'done',
          updatedAt: { gte: sevenDaysAgo },
        },
      }),

      // 9. Priority tasks
      client.task.findMany({
        where: {
          workspaceId,
          status: { not: 'done' },
        },
        include: {
          project: {
            select: { id: true, name: true, key: true },
          },
        },
        take: 30, // take 30, we will sort accurately by priority ranking
      }),

      // 10. Upcoming deadlines
      client.task.findMany({
        where: {
          workspaceId,
          status: { not: 'done' },
          dueDate: { not: null },
        },
        include: {
          project: {
            select: { id: true, name: true, key: true },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),

      // 11. Tasks completed in last 7 days for completion chart
      client.task.findMany({
        where: {
          workspaceId,
          status: 'done',
          updatedAt: { gte: sevenDaysAgo },
        },
        select: { updatedAt: true },
      }),

      // 12. Active projects
      client.project.findMany({
        where: {
          workspaceId,
          status: { not: 'archived' },
        },
        include: {
          tasks: {
            select: { status: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    // Map status groups
    const statusCounts = {
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
    };
    for (const group of statusGroups) {
      if (statusCounts[group.status] !== undefined) {
        statusCounts[group.status] = group._count.status;
      }
    }

    const completedTasksCount = statusCounts.done;
    const velocityRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

    // Rank priority tasks: urgent (4) > high (3) > medium (2) > low (1)
    const priorityWeights = { urgent: 4, high: 3, medium: 2, low: 1 };
    const priorityTasks = priorityTasksRaw
      .sort((a, b) => {
        const weightA = priorityWeights[a.priority] || 0;
        const weightB = priorityWeights[b.priority] || 0;
        if (weightB !== weightA) return weightB - weightA;
        return a.order - b.order;
      })
      .slice(0, 10)
      .map((t) => ({
        ...t,
        _id: t.id,
        project: t.project ? { ...t.project, _id: t.project.id } : null,
      }));

    const upcomingDeadlines = upcomingDeadlinesRaw.map((t) => ({
      ...t,
      _id: t.id,
      project: t.project ? { ...t.project, _id: t.project.id } : null,
    }));

    // Build 7-day completion chart
    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const completionChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const count = completedLast7DaysRaw.filter(
        (t) => t.updatedAt >= dayStart && t.updatedAt <= dayEnd
      ).length;

      completionChart.push({
        day: daysMap[d.getDay()],
        date: dayStart.toISOString().split('T')[0],
        completed: count,
      });
    }

    // Format active projects with progress
    const activeProjects = activeProjectsRaw.map((p) => {
      const taskCount = p.tasks.length;
      const completedCount = p.tasks.filter((t) => t.status === 'done').length;
      const progress = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;
      return {
        _id: p.id,
        id: p.id,
        name: p.name,
        key: p.key,
        category: p.category,
        color: p.color,
        status: p.status,
        taskCount,
        completedCount,
        progress,
      };
    });

    return {
      summary: {
        activeProjectsCount,
        myTasksCount,
        myTasksDueToday,
        myTasksInProgress,
        completedTasksCount,
        completedThisWeek,
        overdueCount,
        velocityRate,
        totalTasksCount,
        statusCounts,
      },
      priorityTasks,
      upcomingDeadlines,
      completionChart,
      activeProjects,
    };
  }
}

export const dashboardRepository = new DashboardRepository();
export default dashboardRepository;
