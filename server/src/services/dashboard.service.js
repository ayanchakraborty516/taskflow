import dashboardRepository from '../repositories/dashboard.repository.js';
import activityService from './activity.service.js';

export class DashboardService {
  constructor(repository = dashboardRepository, activitySvc = activityService) {
    this.repository = repository;
    this.activityService = activitySvc;
  }

  async getDashboardData(workspaceId, userId) {
    const [metrics, recentActivity] = await Promise.all([
      this.repository.getMetrics(workspaceId, userId),
      this.activityService.getRecentActivities(workspaceId, { limit: 15 }),
    ]);

    return {
      ...metrics,
      recentActivity,
    };
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
