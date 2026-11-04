import dashboardService from '../services/dashboard.service.js';
import asyncHandler from '../utils/async-handler.util.js';
import ApiResponse from '../utils/api-response.util.js';

export class DashboardController {
  constructor(service = dashboardService) {
    this.service = service;
  }

  getDashboard = asyncHandler(async (req, res) => {
    const workspaceId = req.workspaceId || req.workspace?.id;
    const userId = req.user?.id;

    const data = await this.service.getDashboardData(workspaceId, userId);

    return ApiResponse.success(res, data);
  });
}

export const dashboardController = new DashboardController();
export default dashboardController;
