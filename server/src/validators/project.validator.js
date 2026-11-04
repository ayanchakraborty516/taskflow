import { z } from 'zod';
import { ALL_PROJECT_STATUSES } from '../constants/statuses.constant.js';

export const createProjectValidator = {
  body: z.object({
    name: z.string().trim().min(1, 'Project name is required').max(100),
    key: z
      .string()
      .trim()
      .min(2, 'Project key must be at least 2 characters')
      .max(10, 'Project key cannot exceed 10 characters')
      .regex(/^[A-Za-z0-9_-]+$/, 'Project key must contain only letters, numbers, hyphens, or underscores')
      .optional(),
    description: z.string().trim().max(2000).optional(),
    category: z.string().trim().max(50).optional(),
    status: z.enum(ALL_PROJECT_STATUSES).optional().default('in_progress'),
    color: z.string().optional(),
    icon: z.string().optional(),
    lead: z.string().trim().min(1).optional().nullable(),
    leadId: z.string().trim().min(1).optional().nullable(),
    startDate: z.string().optional().nullable(),
    targetDate: z.string().optional().nullable(),
    isStarred: z.boolean().optional(),
  }),
};

export const updateProjectValidator = {
  params: z.object({
    id: z.string().min(1, 'Project ID is required'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    key: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    description: z.string().trim().max(2000).optional(),
    category: z.string().trim().max(50).optional(),
    status: z.enum(ALL_PROJECT_STATUSES).optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    lead: z.string().trim().min(1).optional().nullable(),
    leadId: z.string().trim().min(1).optional().nullable(),
    startDate: z.string().optional().nullable(),
    targetDate: z.string().optional().nullable(),
    isStarred: z.boolean().optional(),
  }),
};

export const getProjectValidator = {
  params: z.object({
    id: z.string().min(1, 'Project ID is required'),
  }),
};

export const listProjectsValidator = {
  query: z.object({
    search: z.string().trim().optional(),
    status: z.string().trim().optional(),
    category: z.string().trim().optional(),
    isStarred: z
      .enum(['true', 'false', '1', '0'])
      .transform((val) => val === 'true' || val === '1')
      .optional(),
  }),
};

export const addProjectMemberValidator = {
  params: z.object({
    id: z.string().min(1, 'Project ID is required'),
  }),
  body: z.object({
    userId: z.string().trim().min(1, 'User ID is required'),
  }),
};

export const removeProjectMemberValidator = {
  params: z.object({
    id: z.string().min(1, 'Project ID is required'),
    userId: z.string().min(1, 'User ID is required'),
  }),
};

export default {
  createProjectValidator,
  updateProjectValidator,
  getProjectValidator,
  listProjectsValidator,
  addProjectMemberValidator,
  removeProjectMemberValidator,
};
