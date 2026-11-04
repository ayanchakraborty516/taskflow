import notificationService from '../services/notification.service.js';
import { ApiResponse } from '../utils/api-response.util.js';
import { asyncHandler } from '../utils/async-handler.util.js';

export class NotificationController {
  constructor(service = notificationService) {
    this.service = service;
  }

  getNotifications = asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unreadOnly === 'true';
    const result = await this.service.getNotifications(
      req.workspaceId,
      req.user.id,
      { unreadOnly }
    );
    return ApiResponse.success(res, result);
  });

  markAsRead = asyncHandler(async (req, res) => {
    const result = await this.service.markAsRead(
      req.params.id,
      req.workspaceId,
      req.user.id
    );
    return ApiResponse.success(res, result, 'Marked as read');
  });

  markAllAsRead = asyncHandler(async (req, res) => {
    const result = await this.service.markAllAsRead(
      req.workspaceId,
      req.user.id
    );
    return ApiResponse.success(res, result, 'All notifications marked as read');
  });

  deleteNotification = asyncHandler(async (req, res) => {
    const result = await this.service.deleteNotification(
      req.params.id,
      req.workspaceId,
      req.user.id
    );
    return ApiResponse.success(res, result, 'Notification deleted');
  });
}

export const notificationController = new NotificationController();
export default notificationController;
