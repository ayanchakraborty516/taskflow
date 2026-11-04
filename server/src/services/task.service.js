import taskRepository from '../repositories/task.repository.js';
import subtaskRepository from '../repositories/subtask.repository.js';
import projectRepository from '../repositories/project.repository.js';
import workspaceRepository from '../repositories/workspace.repository.js';
import projectMemberRepository from '../repositories/project-member.repository.js';
import notificationRepository from '../repositories/notification.repository.js';
import activityService from './activity.service.js';
import { runInTransaction } from '../database/transaction.util.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../utils/api-error.util.js';

/**
 * Normalizes task entity output for deterministic API responses,
 * guaranteeing both `id` and `_id` are populated on all entities and sub-entities.
 */
export const formatTask = (task) => {
  if (!task) return null;

  return {
    ...task,
    id: task.id,
    _id: task.id,
    projectId: task.projectId,
    project: task.project
      ? {
          ...task.project,
          id: task.project.id,
          _id: task.project.id,
        }
      : null,
    assignee: task.assignee
      ? {
          ...task.assignee,
          id: task.assignee.id,
          _id: task.assignee.id,
        }
      : null,
    creator: task.creator
      ? {
          ...task.creator,
          id: task.creator.id,
          _id: task.creator.id,
        }
      : null,
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.map((s) => ({
          ...s,
          id: s.id,
          _id: s.id,
        }))
      : [],
  };
};

/**
 * TaskService
 * Implements business logic, multi-tenant permission validation,
 * contiguous Kanban board reordering, and task key generation.
 */
export class TaskService {
  constructor(
    taskRepo = taskRepository,
    subtaskRepo = subtaskRepository,
    projectRepo = projectRepository,
    workspaceRepo = workspaceRepository,
    projectMemberRepo = projectMemberRepository,
    notifRepo = notificationRepository,
    activitySvc = activityService
  ) {
    this.taskRepo = taskRepo;
    this.subtaskRepo = subtaskRepo;
    this.projectRepo = projectRepo;
    this.workspaceRepo = workspaceRepo;
    this.projectMemberRepo = projectMemberRepo;
    this.notifRepo = notifRepo;
    this.activityService = activitySvc;
  }

  /**
   * Creates a new task in a project within the active workspace.
   */
  async createTask(workspaceId, userId, userRole, data) {
    if (userRole === 'Viewer') {
      throw new ForbiddenError('Viewers do not have permission to create tasks.');
    }

    const projectId = data.projectId || data.project;
    if (!projectId) {
      throw new BadRequestError('Project is required to create a task.');
    }

    // Verify project belongs to this workspace
    const project = await this.projectRepo.findById(projectId, workspaceId);
    if (!project) {
      throw new NotFoundError('Project not found in this workspace.');
    }

    // If an assignee is designated, verify they belong to this workspace
    const targetAssigneeId = data.assigneeId || data.assignee;
    if (targetAssigneeId) {
      const assigneeMember = await this.workspaceRepo.getMember(workspaceId, targetAssigneeId);
      if (!assigneeMember) {
        throw new BadRequestError('Assignee must be an active member of this workspace.');
      }

      // Automatically add assignee to project roster if not already present
      const inProject = await this.projectMemberRepo.isMember(projectId, targetAssigneeId);
      if (!inProject) {
        await this.projectMemberRepo.addMember(workspaceId, projectId, targetAssigneeId);
      }
    }

    const result = await runInTransaction(async (tx) => {
      // 1. Calculate task key if not explicitly given
      let taskKey = data.key ? data.key.trim().toUpperCase() : null;
      if (!taskKey) {
        const maxIndex = await this.taskRepo.getMaxTaskKeyIndex(workspaceId, projectId, tx);
        const nextIndex = (maxIndex + 1n).toString();
        taskKey = `${project.key}-${nextIndex}`;
      }

      // 2. Calculate column order if not specified
      const status = data.status || 'todo';
      let order = data.order;
      if (order === undefined || order === null) {
        const maxOrder = await this.taskRepo.getMaxOrder(workspaceId, projectId, status, tx);
        order = maxOrder >= 0 ? maxOrder + 1 : 0;
      }

      const created = await this.taskRepo.create(
        {
          ...data,
          workspaceId,
          projectId,
          creatorId: userId,
          assigneeId: targetAssigneeId || null,
          key: taskKey,
          status,
          order,
        },
        tx
      );

      return formatTask(created);
    });

    // Fire-and-forget activity and notification logging
    this.activityService.logActivity({
      workspaceId,
      userId,
      action: 'task_created',
      details: `Created task "${result.title}"`,
      projectId: result.projectId,
      taskId: result.id,
    }).catch(() => {});

    if (targetAssigneeId && targetAssigneeId !== userId) {
      this.notifRepo.create({
        workspaceId,
        recipientId: targetAssigneeId,
        senderId: userId,
        type: 'task_assigned',
        title: 'Task assigned to you',
        message: `You were assigned to "${result.title}"`,
        link: `/projects/${result.projectId}`,
      }).catch(() => {});
    }

    return result;
  }

  /**
   * Retrieves full details for a task by ID.
   */
  async getTaskById(taskId, workspaceId) {
    const task = await this.taskRepo.findById(taskId, workspaceId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }
    return formatTask(task);
  }

  /**
   * Retrieves a task by key and project.
   */
  async getTaskByKey(key, workspaceId, projectId) {
    const task = await this.taskRepo.findByKey(key, workspaceId, projectId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }
    return formatTask(task);
  }

  /**
   * Lists tasks with filtering, search, pagination, and sorting.
   */
  async listTasks(workspaceId, filters = {}, userId = null) {
    const queryFilters = {
      workspaceId,
      ...filters,
    };

    if (filters.project) queryFilters.projectId = filters.project;
    if (filters.assignee) queryFilters.assigneeId = filters.assignee;
    if (filters.myTasks && userId) {
      queryFilters.assigneeId = userId;
    }

    const [tasks, total] = await Promise.all([
      this.taskRepo.listTasks(queryFilters),
      this.taskRepo.countTasks(queryFilters),
    ]);

    return {
      tasks: tasks.map(formatTask),
      total,
      page: filters.page ? parseInt(filters.page, 10) : 1,
      limit: filters.limit ? parseInt(filters.limit, 10) : tasks.length,
    };
  }

  /**
   * Updates task details.
   */
  async updateTask(taskId, workspaceId, userId, userRole, data) {
    if (userRole === 'Viewer') {
      throw new ForbiddenError('Viewers do not have permission to update tasks.');
    }

    const existing = await this.taskRepo.findById(taskId, workspaceId);
    if (!existing) {
      throw new NotFoundError('Task not found.');
    }

    const updates = { ...data };

    // Handle project relocation if specified
    if (data.projectId && data.projectId !== existing.projectId) {
      const targetProject = await this.projectRepo.findById(data.projectId, workspaceId);
      if (!targetProject) {
        throw new NotFoundError('Target project not found in this workspace.');
      }
      updates.projectId = data.projectId;
    }

    // Handle assignee changes
    if (data.assigneeId !== undefined || data.assignee !== undefined) {
      const targetAssigneeId = data.assigneeId || data.assignee;
      if (targetAssigneeId) {
        const assigneeMember = await this.workspaceRepo.getMember(workspaceId, targetAssigneeId);
        if (!assigneeMember) {
          throw new BadRequestError('Assignee must be an active member of this workspace.');
        }

        const resolvedProjectId = updates.projectId || existing.projectId;
        const inProject = await this.projectMemberRepo.isMember(resolvedProjectId, targetAssigneeId);
        if (!inProject) {
          await this.projectMemberRepo.addMember(workspaceId, resolvedProjectId, targetAssigneeId);
        }
        updates.assigneeId = targetAssigneeId;
      } else {
        updates.assigneeId = null;
      }
    }

    const updated = await this.taskRepo.update(taskId, workspaceId, updates);
    const formatted = formatTask(updated);

    if (updates.status && updates.status !== existing.status) {
      this.activityService.logActivity({
        workspaceId,
        userId,
        action: 'task_status_changed',
        details: `Updated status of "${formatted.title}" to ${formatted.status}`,
        projectId: formatted.projectId,
        taskId: formatted.id,
      }).catch(() => {});

      if (formatted.assigneeId && formatted.assigneeId !== userId) {
        this.notifRepo.create({
          workspaceId,
          recipientId: formatted.assigneeId,
          senderId: userId,
          type: 'task_status',
          title: 'Task status updated',
          message: `Status of "${formatted.title}" was changed to ${formatted.status}`,
          link: `/projects/${formatted.projectId}`,
        }).catch(() => {});
      }
    }

    return formatted;
  }

  /**
   * Moves a task to a target column and/or position, maintaining contiguous ordering.
   */
  async moveTask(taskId, workspaceId, userId, userRole, { status, newOrder }) {
    if (userRole === 'Viewer') {
      throw new ForbiddenError('Viewers do not have permission to move tasks.');
    }

    const task = await this.taskRepo.findById(taskId, workspaceId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    const currentStatus = task.status;
    const targetStatus = status || currentStatus;
    const currentOrder = task.order;
    const projectId = task.projectId;

    const result = await runInTransaction(async (tx) => {
      // Case A: Moving within the same column
      if (currentStatus === targetStatus) {
        if (newOrder === undefined || newOrder === null || newOrder === currentOrder) {
          return formatTask(task);
        }

        const columnTasks = await this.taskRepo.getTasksInColumn(workspaceId, projectId, currentStatus, tx);
        const filtered = columnTasks.filter((t) => t.id !== taskId);
        const insertIndex = Math.max(0, Math.min(newOrder, filtered.length));
        filtered.splice(insertIndex, 0, task);

        // Batch update tasks whose order shifted
        const batchUpdates = [];
        filtered.forEach((t, index) => {
          if (t.order !== index || t.id === taskId) {
            batchUpdates.push({ id: t.id, status: currentStatus, order: index });
          }
        });

        if (batchUpdates.length > 0) {
          await this.taskRepo.batchUpdateTaskOrders(workspaceId, batchUpdates, tx);
        }

        const updated = await this.taskRepo.findById(taskId, workspaceId, tx);
        return formatTask(updated);
      }

      // Case B: Moving to a different column
      // 1. Close gaps in the source column
      const sourceTasks = await this.taskRepo.getTasksInColumn(workspaceId, projectId, currentStatus, tx);
      const remainingSource = sourceTasks.filter((t) => t.id !== taskId);
      const sourceBatch = [];
      remainingSource.forEach((t, index) => {
        if (t.order !== index) {
          sourceBatch.push({ id: t.id, status: currentStatus, order: index });
        }
      });

      // 2. Insert into the target column at target position
      const targetTasks = await this.taskRepo.getTasksInColumn(workspaceId, projectId, targetStatus, tx);
      const insertIndex = newOrder !== undefined && newOrder !== null
        ? Math.max(0, Math.min(newOrder, targetTasks.length))
        : targetTasks.length;

      targetTasks.splice(insertIndex, 0, task);
      const targetBatch = [];
      targetTasks.forEach((t, index) => {
        if (t.id === taskId || t.order !== index) {
          targetBatch.push({ id: t.id, status: targetStatus, order: index });
        }
      });

      // Execute updates atomically
      const allUpdates = [...sourceBatch, ...targetBatch];
      if (allUpdates.length > 0) {
        await this.taskRepo.batchUpdateTaskOrders(workspaceId, allUpdates, tx);
      }

      const updated = await this.taskRepo.findById(taskId, workspaceId, tx);
      return formatTask(updated);
    });

    if (targetStatus !== currentStatus) {
      this.activityService.logActivity({
        workspaceId,
        userId,
        action: 'task_moved',
        details: `Moved task "${task.title}" to ${targetStatus}`,
        projectId: task.projectId,
        taskId: task.id,
      }).catch(() => {});
    }

    return result;
  }

  /**
   * Deletes a task and closes the gap in its column.
   */
  async deleteTask(taskId, workspaceId, userId, userRole) {
    if (userRole === 'Viewer') {
      throw new ForbiddenError('Viewers do not have permission to delete tasks.');
    }

    const task = await this.taskRepo.findById(taskId, workspaceId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    const result = await runInTransaction(async (tx) => {
      await this.taskRepo.delete(taskId, workspaceId, tx);

      // Re-order remaining tasks in the column to maintain contiguous indexes
      const remaining = await this.taskRepo.getTasksInColumn(workspaceId, task.projectId, task.status, tx);
      const batchUpdates = [];
      remaining.forEach((t, index) => {
        if (t.order !== index) {
          batchUpdates.push({ id: t.id, status: task.status, order: index });
        }
      });

      if (batchUpdates.length > 0) {
        await this.taskRepo.batchUpdateTaskOrders(workspaceId, batchUpdates, tx);
      }

      return { success: true, id: taskId };
    });

    this.activityService.logActivity({
      workspaceId,
      userId,
      action: 'task_deleted',
      details: `Deleted task "${task.title}"`,
      projectId: task.projectId,
      taskId: null,
    }).catch(() => {});

    return result;
  }

  /**
   * Toggles or sets subtask completion.
   */
  async toggleSubtask(taskId, subtaskId, workspaceId, userId, userRole, explicitCompleted = null) {
    if (userRole === 'Viewer') {
      throw new ForbiddenError('Viewers do not have permission to modify subtasks.');
    }

    const task = await this.taskRepo.findById(taskId, workspaceId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    const updatedSubtask = await this.subtaskRepo.toggle(subtaskId, workspaceId, taskId, explicitCompleted);
    if (!updatedSubtask) {
      throw new NotFoundError('Subtask not found.');
    }

    const allSubtasks = await this.subtaskRepo.listByTask(workspaceId, taskId);
    return {
      subtask: { ...updatedSubtask, _id: updatedSubtask.id },
      subtasks: allSubtasks.map((s) => ({ ...s, _id: s.id })),
    };
  }

  /**
   * Adds a new subtask to a task.
   */
  async createSubtask(taskId, workspaceId, userId, userRole, data) {
    if (userRole === 'Viewer') {
      throw new ForbiddenError('Viewers do not have permission to create subtasks.');
    }

    const task = await this.taskRepo.findById(taskId, workspaceId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    const count = await this.subtaskRepo.countByTask(workspaceId, taskId);
    const order = data.order !== undefined ? data.order : count;

    const subtask = await this.subtaskRepo.create({
      workspaceId,
      taskId,
      title: data.title,
      completed: Boolean(data.completed),
      order,
    });

    const allSubtasks = await this.subtaskRepo.listByTask(workspaceId, taskId);
    return {
      subtask: { ...subtask, _id: subtask.id },
      subtasks: allSubtasks.map((s) => ({ ...s, _id: s.id })),
    };
  }

  /**
   * Deletes a subtask from a task.
   */
  async deleteSubtask(taskId, subtaskId, workspaceId, userId, userRole) {
    if (userRole === 'Viewer') {
      throw new ForbiddenError('Viewers do not have permission to delete subtasks.');
    }

    const task = await this.taskRepo.findById(taskId, workspaceId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    const deleted = await this.subtaskRepo.delete(subtaskId, workspaceId, taskId);
    if (!deleted) {
      throw new NotFoundError('Subtask not found.');
    }

    const allSubtasks = await this.subtaskRepo.listByTask(workspaceId, taskId);
    return {
      success: true,
      subtasks: allSubtasks.map((s) => ({ ...s, _id: s.id })),
    };
  }
}

export const taskService = new TaskService();
export default taskService;
