import express from 'express';
import projectController from '../controllers/project.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireWorkspace } from '../middlewares/workspace.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { WORKSPACE_ROLES } from '../constants/roles.constant.js';
import {
  createProjectValidator,
  updateProjectValidator,
  getProjectValidator,
  listProjectsValidator,
  addProjectMemberValidator,
  removeProjectMemberValidator,
} from '../validators/project.validator.js';

export const projectRouter = express.Router();

// Apply authentication and active workspace resolution to all project routes
projectRouter.use(authenticate);
projectRouter.use(requireWorkspace);

// Project Collection CRUD
projectRouter.get(
  '/',
  validate(listProjectsValidator),
  projectController.listProjects
);

projectRouter.post(
  '/',
  validate(createProjectValidator),
  requireRole([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.MEMBER]),
  projectController.createProject
);

// Individual Project CRUD
projectRouter.get(
  '/:id',
  validate(getProjectValidator),
  projectController.getProject
);

projectRouter.put(
  '/:id',
  validate(updateProjectValidator),
  requireRole([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.MEMBER]),
  projectController.updateProject
);

projectRouter.delete(
  '/:id',
  validate(getProjectValidator),
  requireRole([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN]),
  projectController.deleteProject
);

// Lifecycle actions
projectRouter.post(
  '/:id/archive',
  validate(getProjectValidator),
  requireRole([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.MEMBER]),
  projectController.archiveProject
);

projectRouter.post(
  '/:id/restore',
  validate(getProjectValidator),
  requireRole([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.MEMBER]),
  projectController.restoreProject
);

// Project Membership Management
projectRouter.get(
  '/:id/members',
  validate(getProjectValidator),
  projectController.listProjectMembers
);

projectRouter.post(
  '/:id/members',
  validate(addProjectMemberValidator),
  requireRole([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.MEMBER]),
  projectController.addProjectMember
);

projectRouter.delete(
  '/:id/members/:userId',
  validate(removeProjectMemberValidator),
  requireRole([WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.MEMBER]),
  projectController.removeProjectMember
);

export default projectRouter;
