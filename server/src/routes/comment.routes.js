import express from 'express';
import commentController from '../controllers/comment.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireWorkspace } from '../middlewares/workspace.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createCommentValidator, deleteCommentValidator } from '../validators/comment.validator.js';

export const commentRouter = express.Router();

commentRouter.use(authenticate);
commentRouter.use(requireWorkspace);

commentRouter.get('/task/:taskId', commentController.getCommentsByTask);
commentRouter.post('/', validate(createCommentValidator), commentController.addComment);
commentRouter.delete('/:id', validate(deleteCommentValidator), commentController.deleteComment);

export default commentRouter;
