import activityService from '../services/activity.service.js';
import asyncHandler from '../utils/async-handler.util.js';
import ApiResponse from '../utils/api-response.util.js';

export class ActivityController {
  constructor(service = activityService) {
    this.service = service;
  }

  getActivities = asyncHandler(async (req, res) => {
    const workspaceId = req.workspaceId || req.workspace?.id;
    const { projectId, taskId, limit } = req.query;

    const activities = await this.service.getRecentActivities(workspaceId, {
      projectId,
      taskId,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return ApiResponse.success(res, activities);
  });
}

export const activityController = new ActivityController();
export default activityController;
