import { BaseRepository } from './base.repository.js';
import prisma from '../database/prisma.client.js';

export const subtaskSelect = {
  id: true,
  workspaceId: true,
  taskId: true,
  title: true,
  completed: true,
  order: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * SubtaskRepository
 * Database-access layer for Subtask model with strict workspace tenant enforcement.
 */
export class SubtaskRepository extends BaseRepository {
  constructor(databaseClient = prisma) {
    super('subtask', databaseClient);
  }

  /**
   * Creates a subtask strictly bound to a workspace and task.
   */
  async create(data, tx = null) {
    const client = tx || this.db;

    return client.subtask.create({
      data: {
        workspaceId: data.workspaceId,
        taskId: data.taskId,
        title: data.title.trim(),
        completed: Boolean(data.completed),
        order: data.order !== undefined ? data.order : 0,
      },
      select: subtaskSelect,
    });
  }

  /**
   * Finds a subtask strictly scoped by workspaceId and taskId.
   */
  async findById(id, workspaceId, taskId, tx = null) {
    if (!id || !workspaceId || !taskId) return null;
    const client = tx || this.db;

    return client.subtask.findFirst({
      where: {
        id,
        workspaceId,
        taskId,
      },
      select: subtaskSelect,
    });
  }

  /**
   * Lists subtasks for a task in deterministic order (order ASC, createdAt ASC).
   */
  async listByTask(workspaceId, taskId, tx = null) {
    if (!workspaceId || !taskId) return [];
    const client = tx || this.db;

    return client.subtask.findMany({
      where: {
        workspaceId,
        taskId,
      },
      select: subtaskSelect,
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Updates a subtask strictly scoped to workspace and parent task.
   */
  async update(id, workspaceId, taskId, data, tx = null) {
    if (!id || !workspaceId || !taskId) return null;
    const client = tx || this.db;

    const existing = await this.findById(id, workspaceId, taskId, tx);
    if (!existing) return null;

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.completed !== undefined) updateData.completed = Boolean(data.completed);
    if (data.order !== undefined) updateData.order = data.order;

    return client.subtask.update({
      where: { id },
      data: updateData,
      select: subtaskSelect,
    });
  }

  /**
   * Deletes a subtask strictly scoped to workspace and parent task.
   * Uses atomic deleteMany ensuring zero rows deleted if tenant or task mismatch.
   */
  async delete(id, workspaceId, taskId, tx = null) {
    if (!id || !workspaceId || !taskId) return false;
    const client = tx || this.db;

    const result = await client.subtask.deleteMany({
      where: {
        id,
        workspaceId,
        taskId,
      },
    });

    return result.count > 0;
  }

  /**
   * Toggles or explicitly sets the completed state of a subtask within tenant boundary.
   * If `explicitCompleted` is a boolean, sets `completed` to that value (idempotent, safe for retries).
   * If `explicitCompleted` is null/omitted, flips the current completed state.
   *
   * @param {string} id - Subtask ID
   * @param {string} workspaceId - Workspace ID
   * @param {string} taskId - Task ID
   * @param {boolean|Object|null} [explicitCompletedOrTx=null] - Target completed boolean, or tx if omitted
   * @param {Object} [maybeTx=null] - Optional transaction client
   * @returns {Promise<Object|null>}
   */
  async toggle(id, workspaceId, taskId, explicitCompletedOrTx = null, maybeTx = null) {
    if (!id || !workspaceId || !taskId) return null;

    let targetCompleted = null;
    let tx = null;

    if (typeof explicitCompletedOrTx === 'boolean') {
      targetCompleted = explicitCompletedOrTx;
      tx = maybeTx;
    } else if (explicitCompletedOrTx && typeof explicitCompletedOrTx === 'object') {
      tx = explicitCompletedOrTx;
    }

    const client = tx || this.db;

    const existing = await this.findById(id, workspaceId, taskId, client);
    if (!existing) return null;

    const newCompleted = typeof targetCompleted === 'boolean'
      ? targetCompleted
      : !existing.completed;

    return client.subtask.update({
      where: { id },
      data: {
        completed: newCompleted,
      },
      select: subtaskSelect,
    });
  }

  /**
   * Counts subtasks belonging to a task within a workspace.
   */
  async countByTask(workspaceId, taskId, tx = null) {
    if (!workspaceId || !taskId) return 0;
    const client = tx || this.db;

    return client.subtask.count({
      where: {
        workspaceId,
        taskId,
      },
    });
  }
}

export const subtaskRepository = new SubtaskRepository();
export default subtaskRepository;

