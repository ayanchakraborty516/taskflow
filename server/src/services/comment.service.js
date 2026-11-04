import commentRepository from '../repositories/comment.repository.js';
import taskRepository from '../repositories/task.repository.js';
import notificationRepository from '../repositories/notification.repository.js';
import activityService from './activity.service.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/api-error.util.js';

export const formatComment = (comment) => {
  if (!comment) return null;
  return {
    ...comment,
    id: comment.id,
    _id: comment.id,
    author: comment.author
      ? {
          ...comment.author,
          id: comment.author.id,
          _id: comment.author.id,
        }
      : null,
  };
};

export class CommentService {
  constructor(commentRepo = commentRepository, taskRepo = taskRepository, notifRepo = notificationRepository, activitySvc = activityService) {
    this.commentRepo = commentRepo;
    this.taskRepo = taskRepo;
    this.notifRepo = notifRepo;
    this.activityService = activitySvc;
  }

  async addComment(workspaceId, taskId, authorId, content, userRole) {
    if (userRole === 'Viewer') {
      throw new ForbiddenError('Viewers do not have permission to post comments.');
    }

    if (!taskId) {
      throw new BadRequestError('Task ID is required to post a comment.');
    }

    if (!content || !content.trim()) {
      throw new BadRequestError('Comment content cannot be empty.');
    }

    const task = await this.taskRepo.findById(taskId, workspaceId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    const created = await this.commentRepo.create({
      workspaceId,
      taskId,
      authorId,
      content,
    });

    // Fire-and-forget activity and notification logging
    const trimmed = content.trim();
    const preview = trimmed.length > 50 ? `${trimmed.substring(0, 47)}...` : trimmed;
    this.activityService.logActivity({
      workspaceId,
      userId: authorId,
      action: 'comment_added',
      details: `Commented on task "${task.title}": "${preview}"`,
      projectId: task.projectId,
      taskId: task.id,
    }).catch(() => {});

    if (task.assigneeId && task.assigneeId !== authorId) {
      this.notifRepo.create({
        workspaceId,
        recipientId: task.assigneeId,
        senderId: authorId,
        type: 'comment_added',
        title: 'New comment on your task',
        message: `New comment on "${task.title}": "${preview}"`,
        link: `/projects/${task.projectId}`,
      }).catch(() => {});
    }

    return formatComment(created);
  }

  async getCommentsByTask(workspaceId, taskId) {
    const task = await this.taskRepo.findById(taskId, workspaceId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    const comments = await this.commentRepo.listByTask(workspaceId, taskId);
    return comments.map(formatComment);
  }

  async deleteComment(commentId, workspaceId, userId, userRole) {
    const comment = await this.commentRepo.findById(commentId, workspaceId);
    if (!comment) {
      throw new NotFoundError('Comment not found.');
    }

    const isAuthor = comment.authorId === userId;
    const isOwnerOrAdmin = ['Owner', 'Admin'].includes(userRole);

    if (!isAuthor && !isOwnerOrAdmin) {
      throw new ForbiddenError('You do not have permission to delete this comment.');
    }

    await this.commentRepo.delete(commentId, workspaceId);
    return { success: true, id: commentId };
  }
}

export const commentService = new CommentService();
export default commentService;
