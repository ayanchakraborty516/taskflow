import notificationRepository from '../repositories/notification.repository.js';
import { NotFoundError } from '../utils/api-error.util.js';

export const formatNotification = (notif) => {
  if (!notif) return null;
  return {
    ...notif,
    id: notif.id,
    _id: notif.id,
    sender: notif.sender
      ? {
          ...notif.sender,
          id: notif.sender.id,
          _id: notif.sender.id,
        }
      : null,
  };
};

export class NotificationService {
  constructor(notifRepo = notificationRepository) {
    this.notifRepo = notifRepo;
  }

  async getNotifications(workspaceId, userId, { unreadOnly = false } = {}) {
    const [notifications, unreadCount] = await Promise.all([
      this.notifRepo.listByUser(workspaceId, userId, { unreadOnly }),
      this.notifRepo.countUnread(workspaceId, userId),
    ]);

    return {
      notifications: notifications.map(formatNotification),
      unreadCount,
    };
  }

  async markAsRead(notificationId, workspaceId, userId) {
    const success = await this.notifRepo.markAsRead(notificationId, workspaceId, userId);
    if (!success) {
      throw new NotFoundError('Notification not found.');
    }
    return { success: true };
  }

  async markAllAsRead(workspaceId, userId) {
    const updatedCount = await this.notifRepo.markAllAsRead(workspaceId, userId);
    return { success: true, updatedCount };
  }

  async deleteNotification(notificationId, workspaceId, userId) {
    const success = await this.notifRepo.delete(notificationId, workspaceId, userId);
    if (!success) {
      throw new NotFoundError('Notification not found.');
    }
    return { success: true };
  }
}

export const notificationService = new NotificationService();
export default notificationService;
