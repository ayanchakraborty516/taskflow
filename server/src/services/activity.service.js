import activityRepository from '../repositories/activity.repository.js';
import logger from '../utils/logger.util.js';

export class ActivityService {
  constructor(repository = activityRepository) {
    this.repository = repository;
  }

  async logActivity({ workspaceId, userId, action, details, projectId = null, taskId = null }, tx = null) {
    try {
      if (!workspaceId || !userId || !action || !details) {
        return null;
      }
      return await this.repository.create({
        workspaceId,
        userId,
        action,
        details,
        projectId,
        taskId,
      }, tx);
    } catch (error) {
      logger.error('Failed to log activity:', error);
      return null;
    }
  }

  async getRecentActivities(workspaceId, options = {}) {
    return this.repository.listByWorkspace(workspaceId, options);
  }
}

export const activityService = new ActivityService();
export default activityService;
