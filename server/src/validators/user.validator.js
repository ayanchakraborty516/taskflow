import { z } from 'zod';

export const getUsersValidator = {
  query: z.object({
    search: z.string().optional(),
    workspaceId: z.string().optional(),
  }),
};

export const getUserByIdValidator = {
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
};

export default {
  getUsersValidator,
  getUserByIdValidator,
};

