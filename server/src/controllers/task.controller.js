import taskService from '../services/task.service.js';
import { ApiResponse } from '../utils/api-response.util.js';
import { asyncHandler } from '../utils/async-handler.util.js';

/**
 * TaskController
 * HTTP request/response handler for Task and Subtask endpoints.
 */
export class TaskController {
  constructor(service = taskService) {
    this.service = service;
  }

  /**
   * POST /api/tasks
   * Creates a new task in the active workspace.
   */
  createTask = asyncHandler(async (req, res) => {
    const task = await this.service.createTask(
      req.workspaceId,
      req.user.id,
      req.workspaceRole,
      req.body
    );
    return ApiResponse.created(res, { task }, 'Task created successfully');
  });

  /**
   * GET /api/tasks
   * Lists tasks in the active workspace with filtering, sorting, pagination, or search.
   */
  listTasks = asyncHandler(async (req, res) => {
    const filters = req.validatedQuery || req.query;
    const { tasks, total, page, limit } = await this.service.listTasks(
      req.workspaceId,
      filters,
      req.user.id
    );
    return ApiResponse.success(res, {
      tasks,
      count: total,
      pagination: {
        total,
        page,
        limit,
        totalPages: limit ? Math.ceil(total / limit) : 1,
      },
    });
  });

  /**
   * GET /api/tasks/:id
   * Retrieves full details for a single task.
   */
  getTask = asyncHandler(async (req, res) => {
    const task = await this.service.getTaskById(req.params.id, req.workspaceId);
    return ApiResponse.success(res, { task });
  });

  /**
   * PUT /api/tasks/:id
   * Updates an existing task's fields or subtasks.
   */
  updateTask = asyncHandler(async (req, res) => {
    const task = await this.service.updateTask(
      req.params.id,
      req.workspaceId,
      req.user.id,
      req.workspaceRole,
      req.body
    );
    return ApiResponse.success(res, { task }, 'Task updated successfully');
  });

  /**
   * DELETE /api/tasks/:id
   * Deletes a task.
   */
  deleteTask = asyncHandler(async (req, res) => {
    const result = await this.service.deleteTask(
      req.params.id,
      req.workspaceId,
      req.user.id,
      req.workspaceRole
    );
    return ApiResponse.success(res, result, 'Task deleted successfully');
  });

  /**
   * POST /api/tasks/:id/move
   * Moves a task to a target column or position.
   */
  moveTask = asyncHandler(async (req, res) => {
    const task = await this.service.moveTask(
      req.params.id,
      req.workspaceId,
      req.user.id,
      req.workspaceRole,
      req.body
    );
    return ApiResponse.success(res, { task }, 'Task moved successfully');
  });

  /**
   * PUT /api/tasks/:id/subtasks/:subtaskId
   * Toggles or sets subtask completion.
   */
  toggleSubtask = asyncHandler(async (req, res) => {
    const explicitCompleted = req.body && req.body.completed !== undefined
      ? req.body.completed
      : null;

    const result = await this.service.toggleSubtask(
      req.params.id,
      req.params.subtaskId,
      req.workspaceId,
      req.user.id,
      req.workspaceRole,
      explicitCompleted
    );

    return ApiResponse.success(res, result, 'Subtask updated successfully');
  });

  /**
   * POST /api/tasks/:id/subtasks
   * Creates a standalone subtask for a task.
   */
  createSubtask = asyncHandler(async (req, res) => {
    const result = await this.service.createSubtask(
      req.params.id,
      req.workspaceId,
      req.user.id,
      req.workspaceRole,
      req.body
    );
    return ApiResponse.created(res, result, 'Subtask created successfully');
  });

  /**
   * DELETE /api/tasks/:id/subtasks/:subtaskId
   * Deletes a standalone subtask.
   */
  deleteSubtask = asyncHandler(async (req, res) => {
    const result = await this.service.deleteSubtask(
      req.params.id,
      req.params.subtaskId,
      req.workspaceId,
      req.user.id,
      req.workspaceRole
    );
    return ApiResponse.success(res, result, 'Subtask deleted successfully');
  });
}

export const taskController = new TaskController();
export default taskController;
