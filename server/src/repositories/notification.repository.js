import prisma from '../database/prisma.client.js';

export const notificationInclude = {
  sender: {
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
    },
  },
};

export class NotificationRepository {
  constructor(databaseClient = prisma) {
    this.db = databaseClient;
  }

  async create({ workspaceId, recipientId, senderId, type = 'system', title, message, link = '' }, tx = null) {
    const client = tx || this.db;
    return client.notification.create({
      data: {
        workspaceId,
        recipientId,
        senderId: senderId || null,
        type,
        title,
        message,
        link,
      },
      include: notificationInclude,
    });
  }

  async listByUser(workspaceId, recipientId, { unreadOnly = false } = {}, tx = null) {
    if (!workspaceId || !recipientId) return [];
    const client = tx || this.db;

    const where = {
      workspaceId,
      recipientId,
    };

    if (unreadOnly) {
      where.read = false;
    }

    return client.notification.findMany({
      where,
      include: notificationInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async countUnread(workspaceId, recipientId, tx = null) {
    if (!workspaceId || !recipientId) return 0;
    const client = tx || this.db;
    return client.notification.count({
      where: {
        workspaceId,
        recipientId,
        read: false,
      },
    });
  }

  async markAsRead(id, workspaceId, recipientId, tx = null) {
    if (!id || !workspaceId || !recipientId) return false;
    const client = tx || this.db;
    const res = await client.notification.updateMany({
      where: {
        id,
        workspaceId,
        recipientId,
      },
      data: {
        read: true,
      },
    });
    return res.count > 0;
  }

  async markAllAsRead(workspaceId, recipientId, tx = null) {
    if (!workspaceId || !recipientId) return 0;
    const client = tx || this.db;
    const res = await client.notification.updateMany({
      where: {
        workspaceId,
        recipientId,
        read: false,
      },
      data: {
        read: true,
      },
    });
    return res.count;
  }

  async delete(id, workspaceId, recipientId, tx = null) {
    if (!id || !workspaceId || !recipientId) return false;
    const client = tx || this.db;
    const res = await client.notification.deleteMany({
      where: {
        id,
        workspaceId,
        recipientId,
      },
    });
    return res.count > 0;
  }
}

export const notificationRepository = new NotificationRepository();
export default notificationRepository;
