import { z } from 'zod';
import { ALL_WORKSPACE_ROLES } from '../constants/roles.constant.js';

export const createWorkspaceValidator = {
  body: z.object({
    name: z.string().trim().min(2, 'Workspace name must be at least 2 characters').max(80),
    description: z.string().trim().max(300).optional(),
    color: z.string().optional(),
  }),
};

export const updateWorkspaceValidator = {
  params: z.object({
    id: z.string().min(1, 'Workspace ID is required'),
  }),
  body: z.object({
    name: z.string().trim().min(2, 'Workspace name must be at least 2 characters').max(80).optional(),
    description: z.string().trim().max(300).optional(),
    color: z.string().optional(),
  }),
};

export const joinWorkspaceValidator = {
  body: z.object({
    inviteCode: z.string().trim().min(1, 'Invite code is required'),
  }),
};

export const addMemberValidator = {
  params: z.object({
    id: z.string().min(1, 'Workspace ID is required'),
  }),
  body: z.object({
    email: z.string().trim().email('Valid email is required'),
    role: z.enum(ALL_WORKSPACE_ROLES).default('Member'),
  }),
};

export const updateMemberRoleValidator = {
  params: z.object({
    id: z.string().min(1, 'Workspace ID is required'),
    userId: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    role: z.enum(ALL_WORKSPACE_ROLES, {
      errorMap: () => ({ message: `Role must be one of: ${ALL_WORKSPACE_ROLES.join(', ')}` }),
    }),
  }),
};

export const transferOwnershipValidator = {
  params: z.object({
    id: z.string().min(1, 'Workspace ID is required'),
  }),
  body: z.object({
    newOwnerId: z.string().trim().min(1, 'New owner ID is required'),
  }),
};

export const workspaceIdParamValidator = {
  params: z.object({
    id: z.string().min(1, 'Workspace ID is required'),
  }),
};

export const memberParamValidator = {
  params: z.object({
    id: z.string().min(1, 'Workspace ID is required'),
    userId: z.string().min(1, 'User ID is required'),
  }),
};

export default {
  createWorkspaceValidator,
  updateWorkspaceValidator,
  joinWorkspaceValidator,
  addMemberValidator,
  updateMemberRoleValidator,
  transferOwnershipValidator,
  workspaceIdParamValidator,
  memberParamValidator,
};
