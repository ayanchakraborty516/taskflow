import { z } from 'zod';

export const registerValidator = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name cannot exceed 60 characters'),
    email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    workspaceName: z.string().trim().optional(),
  }),
};

export const loginValidator = {
  body: z.object({
    email: z.string().trim().email('Please provide a valid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
};

export const updateProfileValidator = {
  body: z.object({
    name: z.string().trim().min(2).max(60).optional(),
    avatar: z.string().optional(),
    jobTitle: z.string().trim().optional(),
    currentWorkspace: z.string().optional(),
  }),
};

export const changePasswordValidator = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  }),
};

export const refreshTokenValidator = {
  body: z.object({
    refreshToken: z.string().optional(),
  }),
};

export default {
  registerValidator,
  loginValidator,
  updateProfileValidator,
  changePasswordValidator,
  refreshTokenValidator,
};
