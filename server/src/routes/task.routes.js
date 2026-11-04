import express from 'express';
import taskController from '../controllers/task.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireWorkspace } from '../middlewares/workspace.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { WORKSPACE_ROLES } from '../constants/roles.constant.js';
import {
  createTaskValidator,
  updateTaskValidator,
  moveTaskValidator,
  getTaskValidator,
  deleteTaskValidator,
  listTasksValidator,
  toggleSubtaskValidator,
  createSubtaskValidator,
} from '../validators/task.validator.js';

export const taskRouter = express.Router();

// Apply authentication and active workspace resolution to all task routes
taskRouter.use(authenticate);
taskRouter.use(requireWorkspace);

const WRITE_ROLES = [WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.MEMBER];

// Task collection endpoints
taskRouter.get(
  '/',
  validate(listTasksValidator),
  taskController.listTasks
);

taskRouter.post(
  '/',
  validate(createTaskValidator),
  requireRole(WRITE_ROLES),
  taskController.createTask
);

// Individual task endpoints
taskRouter.get(
  '/:id',
  validate(getTaskValidator),
  taskController.getTask
);

taskRouter.put(
  '/:id',
  validate(updateTaskValidator),
  requireRole(WRITE_ROLES),
  taskController.updateTask
);

taskRouter.delete(
  '/:id',
  validate(deleteTaskValidator),
  requireRole(WRITE_ROLES),
  taskController.deleteTask
);

// Task reordering & Kanban movement
taskRouter.post(
  '/:id/move',
  validate(moveTaskValidator),
  requireRole(WRITE_ROLES),
  taskController.moveTask
);

// Subtask endpoints
taskRouter.put(
  '/:id/subtasks/:subtaskId',
  validate(toggleSubtaskValidator),
  requireRole(WRITE_ROLES),
  taskController.toggleSubtask
);

taskRouter.post(
  '/:id/subtasks',
  validate(createSubtaskValidator),
  requireRole(WRITE_ROLES),
  taskController.createSubtask
);

taskRouter.delete(
  '/:id/subtasks/:subtaskId',
  requireRole(WRITE_ROLES),
  taskController.deleteSubtask
);

export default taskRouter;
