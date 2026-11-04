import commentService from '../services/comment.service.js';
import { ApiResponse } from '../utils/api-response.util.js';
import { asyncHandler } from '../utils/async-handler.util.js';

export class CommentController {
  constructor(service = commentService) {
    this.service = service;
  }

  getCommentsByTask = asyncHandler(async (req, res) => {
    const comments = await this.service.getCommentsByTask(
      req.workspaceId,
      req.params.taskId
    );
    return ApiResponse.success(res, { comments });
  });

  addComment = asyncHandler(async (req, res) => {
    const taskId = req.body.taskId || req.body.task;
    const comment = await this.service.addComment(
      req.workspaceId,
      taskId,
      req.user.id,
      req.body.content,
      req.workspaceRole
    );
    return ApiResponse.created(res, { comment }, 'Comment added successfully');
  });

  deleteComment = asyncHandler(async (req, res) => {
    const result = await this.service.deleteComment(
      req.params.id,
      req.workspaceId,
      req.user.id,
      req.workspaceRole
    );
    return ApiResponse.success(res, result, 'Comment deleted successfully');
  });
}

export const commentController = new CommentController();
export default commentController;
