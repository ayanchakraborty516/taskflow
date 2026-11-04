import prisma from '../database/prisma.client.js';

export const commentInclude = {
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      jobTitle: true,
    },
  },
};

export class CommentRepository {
  constructor(databaseClient = prisma) {
    this.db = databaseClient;
  }

  async create({ workspaceId, taskId, authorId, content }, tx = null) {
    const client = tx || this.db;
    return client.comment.create({
      data: {
        workspaceId,
        taskId,
        authorId,
        content: content.trim(),
      },
      include: commentInclude,
    });
  }

  async findById(id, workspaceId, tx = null) {
    if (!id || !workspaceId) return null;
    const client = tx || this.db;
    return client.comment.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: commentInclude,
    });
  }

  async listByTask(workspaceId, taskId, tx = null) {
    if (!workspaceId || !taskId) return [];
    const client = tx || this.db;
    return client.comment.findMany({
      where: {
        workspaceId,
        taskId,
      },
      include: commentInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async delete(id, workspaceId, tx = null) {
    if (!id || !workspaceId) return false;
    const client = tx || this.db;
    const res = await client.comment.deleteMany({
      where: {
        id,
        workspaceId,
      },
    });
    return res.count > 0;
  }
}

export const commentRepository = new CommentRepository();
export default commentRepository;
