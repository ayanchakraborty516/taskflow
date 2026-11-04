import { z } from 'zod';

export const createCommentValidator = {
  body: z.object({
    content: z.string().trim().min(1, 'Comment content is required').max(3000),
    taskId: z.string().min(1, 'Task ID is required'),
  }),
};

export const updateCommentValidator = {
  params: z.object({
    id: z.string().min(1, 'Comment ID is required'),
  }),
  body: z.object({
    content: z.string().trim().min(1, 'Comment content is required').max(3000),
  }),
};

export const deleteCommentValidator = {
  params: z.object({
    id: z.string().min(1, 'Comment ID is required'),
  }),
};

export default {
  createCommentValidator,
  updateCommentValidator,
  deleteCommentValidator,
};

