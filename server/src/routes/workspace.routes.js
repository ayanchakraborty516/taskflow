import express from 'express';
import workspaceController from '../controllers/workspace.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireWorkspace } from '../middlewares/workspace.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { WORKSPACE_ROLES } from '../constants/roles.constant.js';
import {
  createWorkspaceValidator,
  updateWorkspaceValidator,
  joinWorkspaceValidator,
  addMemberValidator,
  updateMemberRoleValidator,
  transferOwnershipValidator,
  workspaceIdParamValidator,
  memberParamValidator,
} from '../validators/workspace.validator.js';

export const workspaceRouter = express.Router();

// Apply authentication to all workspace routes
workspaceRouter.use(authenticate);

// Collection-level routes (precede parameterized /:id routes)
workspaceRouter.get('/', workspaceController.listWorkspaces);
workspaceRouter.post('/', validate(createWorkspaceValidator), workspaceController.createWorkspace);
workspaceRouter.get('/current', workspaceController.getCurrentWorkspace);
workspaceRouter.post('/join', validate(joinWorkspaceValidator), workspaceController.joinWorkspace);

// Workspace-scoped routes (require membership verification via requireWorkspace)
workspaceRouter.get(
  '/:id',
  validate(workspaceIdParamValidator),
  requireWorkspace,
  workspaceController.getWorkspace
);

workspaceRouter.put(
  '/:id',
  validate(updateWorkspaceValidator),
  requireWorkspace,
  requireRole([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN]),
  workspaceController.updateWorkspace
);

workspaceRouter.delete(
  '/:id',
  validate(workspaceIdParamValidator),
  requireWorkspace,
  requireRole([WORKSPACE_ROLES.OWNER]),
  workspaceController.deleteWorkspace
);

workspaceRouter.post(
  '/:id/switch',
  validate(workspaceIdParamValidator),
  requireWorkspace,
  workspaceController.switchWorkspace
);

workspaceRouter.post(
  '/:id/leave',
  validate(workspaceIdParamValidator),
  requireWorkspace,
  workspaceController.leaveWorkspace
);

workspaceRouter.post(
  '/:id/transfer-ownership',
  validate(transferOwnershipValidator),
  requireWorkspace,
  requireRole([WORKSPACE_ROLES.OWNER]),
  workspaceController.transferOwnership
);

// Membership routes
workspaceRouter.get(
  '/:id/members',
  validate(workspaceIdParamValidator),
  requireWorkspace,
  workspaceController.listMembers
);

workspaceRouter.post(
  '/:id/members',
  validate(addMemberValidator),
  requireWorkspace,
  requireRole([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN]),
  workspaceController.addMember
);

workspaceRouter.put(
  '/:id/members/:userId',
  validate(updateMemberRoleValidator),
  requireWorkspace,
  requireRole([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN]),
  workspaceController.updateMemberRole
);

workspaceRouter.delete(
  '/:id/members/:userId',
  validate(memberParamValidator),
  requireWorkspace,
  requireRole([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN]),
  workspaceController.removeMember
);

export default workspaceRouter;
