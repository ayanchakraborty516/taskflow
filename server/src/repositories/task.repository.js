import { BaseRepository } from './base.repository.js';
import prisma from '../database/prisma.client.js';

/**
 * Error raised when a case-insensitive task key lookup matches more than one record
 * within a project, indicating case-variant ambiguity.
 */
export class AmbiguousTaskKeyError extends Error {
  constructor(key, count) {
    super(`Ambiguous task key '${key}': found ${count} case-insensitive matches in project.`);
    this.name = 'AmbiguousTaskKeyError';
    this.code = 'AMBIGUOUS_TASK_KEY';
    this.key = key;
    this.matchCount = count;
  }
}

/**
 * Standard relation selection for Task entity to satisfy frontend contract
 * while preventing sensitive field leakage.
 */
export const taskInclude = {
  project: {
    select: {
      id: true,
      name: true,
      key: true,
      color: true,
    },
  },
  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      jobTitle: true,
    },
  },
  creator: {
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      jobTitle: true,
    },
  },
  subtasks: {
    select: {
      id: true,
      workspaceId: true,
      taskId: true,
      title: true,
      completed: true,
      order: true,
      createdAt: true,
    },
    orderBy: [
      { order: 'asc' },
      { createdAt: 'asc' },
    ],
  },
};

/**
 * TaskRepository
 * Data access layer for Task entities with strict multi-tenant isolation.
 */
export class TaskRepository extends BaseRepository {
  constructor(databaseClient = prisma) {
    super('task', databaseClient);
  }

  /**
   * Creates a new task within a workspace.
   */
  async create(data, tx = null) {
    const client = tx || this.db;

    const taskData = {
      workspaceId: data.workspaceId,
      projectId: data.projectId,
      creatorId: data.creatorId,
      title: data.title.trim(),
      description: data.description ? data.description.trim() : '',
      key: data.key || null,
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      assigneeId: data.assigneeId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      labels: Array.isArray(data.labels) ? data.labels : [],
      order: data.order !== undefined ? data.order : 0,
    };

    if (Array.isArray(data.subtasks) && data.subtasks.length > 0) {
      taskData.subtasks = {
        create: data.subtasks.map((s, index) => ({
          title: s.title.trim(),
          completed: Boolean(s.completed),
          order: s.order !== undefined ? s.order : index,
        })),
      };
    }

    return client.task.create({
      data: taskData,
      include: taskInclude,
    });
  }

  /**
   * Finds a task by ID strictly scoped to a workspace.
   */
  async findById(id, workspaceId, tx = null) {
    if (!id || !workspaceId) return null;
    const client = tx || this.db;

    return client.task.findUnique({
      where: {
        workspaceId_id: {
          workspaceId,
          id,
        },
      },
      include: taskInclude,
    });
  }

  /**
   * Finds a task by key, strictly scoped to both workspace and project.
   * Note: The database unique constraint is @@unique([projectId, key]).
   * Because keys are scoped per project, both workspaceId and projectId are mandatory
   * to guarantee exact, tenant-isolated resolution and prevent ambiguous lookups.
   *
   * Lookup behavior:
   * 1. Search for exact key first.
   * 2. If an exact match exists, return it.
   * 3. Otherwise, determine case-insensitive matches within the same workspace and project.
   * 4. If exactly one match exists, return it.
   * 5. If more than one match exists, raise an AmbiguousTaskKeyError.
   * 6. If no match exists, return null.
   *
   * @param {string|Object} keyOrParams - Task key string (e.g. 'PROJ-1') or options object
   * @param {string} [workspaceId] - Workspace ID (mandatory tenant scope)
   * @param {string} [projectId] - Project ID (mandatory project scope)
   * @param {Object} [tx=null] - Optional Prisma transaction client
   * @returns {Promise<Object|null>}
   * @throws {AmbiguousTaskKeyError} If multiple case-variant records match a case-insensitive query
   */
  async findByKey(keyOrParams, workspaceId, projectId, tx = null) {
    let resolvedKey = keyOrParams;
    let resolvedWorkspaceId = workspaceId;
    let resolvedProjectId = projectId;
    let client = tx || this.db;

    if (keyOrParams && typeof keyOrParams === 'object') {
      resolvedKey = keyOrParams.key;
      resolvedWorkspaceId = keyOrParams.workspaceId;
      resolvedProjectId = keyOrParams.projectId;
      client = keyOrParams.tx || tx || this.db;
    }

    // Both workspaceId and projectId are mandatory for project-scoped key lookup
    if (!resolvedKey || !resolvedWorkspaceId || !resolvedProjectId) {
      return null;
    }

    const trimmedKey = String(resolvedKey).trim();

    // 1. Search for exact key first
    const exactMatch = await client.task.findFirst({
      where: {
        workspaceId: resolvedWorkspaceId,
        projectId: resolvedProjectId,
        key: trimmedKey,
      },
      include: taskInclude,
    });

    // 2. If an exact match exists, return it
    if (exactMatch) {
      return exactMatch;
    }

    // 3. Fallback: determine case-insensitive matches within the same workspace and project
    const matches = await client.task.findMany({
      where: {
        workspaceId: resolvedWorkspaceId,
        projectId: resolvedProjectId,
        key: {
          equals: trimmedKey,
          mode: 'insensitive',
        },
      },
      include: taskInclude,
    });

    // 4. If exactly one match exists, return it
    if (matches.length === 1) {
      return matches[0];
    }

    // 5. If more than one match exists, raise a clear ambiguity error
    if (matches.length > 1) {
      throw new AmbiguousTaskKeyError(trimmedKey, matches.length);
    }

    // 6. If no match exists, return null
    return null;
  }

  /**
   * Updates a task strictly scoped to a workspace.
   */
  async update(id, workspaceId, data, tx = null) {
    if (!id || !workspaceId) return null;
    const client = tx || this.db;

    const updateData = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description.trim();
    if (data.projectId !== undefined) updateData.projectId = data.projectId;
    if (data.key !== undefined) updateData.key = data.key;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.labels !== undefined) updateData.labels = Array.isArray(data.labels) ? data.labels : [];
    if (data.order !== undefined) updateData.order = data.order;

    // Handle subtask updates if an entire subtasks array was provided
    if (Array.isArray(data.subtasks)) {
      await client.subtask.deleteMany({
        where: {
          workspaceId,
          taskId: id,
        },
      });

      if (data.subtasks.length > 0) {
        updateData.subtasks = {
          create: data.subtasks.map((s, index) => ({
            title: s.title.trim(),
            completed: Boolean(s.completed),
            order: s.order !== undefined ? s.order : index,
          })),
        };
      }
    }

    return client.task.update({
      where: {
        workspaceId_id: {
          workspaceId,
          id,
        },
      },
      data: updateData,
      include: taskInclude,
    });
  }

  /**
   * Deletes a task strictly scoped to a workspace (cascades subtasks, comments).
   */
  async delete(id, workspaceId, tx = null) {
    if (!id || !workspaceId) return false;
    const client = tx || this.db;

    return client.task.delete({
      where: {
        workspaceId_id: {
          workspaceId,
          id,
        },
      },
    });
  }

  /**
   * Builds the Prisma `where` clause for task queries with strict workspace scoping.
   */
  buildWhereClause({
    workspaceId,
    projectId,
    project,
    status,
    priority,
    assigneeId,
    assignee,
    myTasks,
    userId,
    search,
  }) {
    if (!workspaceId) {
      throw new Error('workspaceId is required for task listing.');
    }

    const where = {
      workspaceId,
    };

    const resolvedProjectId = projectId || project;
    if (resolvedProjectId) {
      where.projectId = resolvedProjectId;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (priority && priority !== 'all') {
      where.priority = priority;
    }

    const resolvedAssigneeId = assigneeId || assignee;
    if (resolvedAssigneeId) {
      where.assigneeId = resolvedAssigneeId;
    }

    if (myTasks && userId) {
      where.assigneeId = userId;
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { key: { contains: term, mode: 'insensitive' } },
        { labels: { has: term } },
      ];
    }

    return where;
  }

  /**
   * Builds the Prisma `orderBy` clause for task listing queries.
   */
  buildOrderBy(sort) {
    switch (sort) {
      case 'dueDate':
        return [{ dueDate: 'asc' }, { createdAt: 'desc' }];
      case 'priority':
        return [{ priority: 'desc' }, { createdAt: 'desc' }];
      case 'title':
        return [{ title: 'asc' }, { createdAt: 'desc' }];
      case 'created':
        return [{ createdAt: 'desc' }];
      case 'order':
      default:
        return [{ order: 'asc' }, { createdAt: 'desc' }];
    }
  }

  /**
   * Lists tasks with filtering, sorting, and pagination.
   */
  async listTasks(filters = {}, tx = null) {
    const client = tx || this.db;
    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderBy(filters.sort);

    const queryOptions = {
      where,
      include: taskInclude,
      orderBy,
    };

    if (filters.page && filters.limit) {
      const pageNum = Math.max(1, parseInt(filters.page, 10));
      const limitNum = Math.max(1, parseInt(filters.limit, 10));
      queryOptions.skip = (pageNum - 1) * limitNum;
      queryOptions.take = limitNum;
    }

    return client.task.findMany(queryOptions);
  }

  /**
   * Counts tasks matching filter conditions strictly within a workspace.
   */
  async countTasks(filters = {}, tx = null) {
    const client = tx || this.db;
    const where = this.buildWhereClause(filters);
    return client.task.count({ where });
  }

  /**
   * Finds the highest `order` index in a Kanban column for a project.
   * Returns -1 if the column is currently empty.
   */
  async getMaxOrder(workspaceId, projectId, status, tx = null) {
    if (!workspaceId || !projectId || !status) return -1;
    const client = tx || this.db;

    const highest = await client.task.findFirst({
      where: {
        workspaceId,
        projectId,
        status,
      },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return highest !== null && highest !== undefined ? highest.order : -1;
  }

  /**
   * Retrieves all tasks in a column ordered by `order asc, createdAt desc`.
   */
  async getTasksInColumn(workspaceId, projectId, status, tx = null) {
    if (!workspaceId || !projectId || !status) return [];
    const client = tx || this.db;

    return client.task.findMany({
      where: {
        workspaceId,
        projectId,
        status,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      include: taskInclude,
    });
  }

  /**
   * Updates a single task's status and/or order within workspace boundary.
   */
  async updateTaskOrderAndStatus(id, workspaceId, { status, order }, tx = null) {
    if (!id || !workspaceId) return null;
    const client = tx || this.db;

    const data = {};
    if (status !== undefined) data.status = status;
    if (order !== undefined) data.order = order;

    return client.task.update({
      where: {
        workspaceId_id: {
          workspaceId,
          id,
        },
      },
      data,
      include: taskInclude,
    });
  }

  /**
   * Applies bulk task order and status updates within a workspace.
   * Scoped strictly by workspaceId_id. Executes atomically inside a transaction.
   *
   * @param {string} workspaceId - Workspace ID
   * @param {Array<Object>} updates - Array of { id, status, order }
   * @param {Object} [tx=null] - Optional external transaction client
   * @returns {Promise<Array<Object>>}
   */
  async batchUpdateTaskOrders(workspaceId, updates = [], tx = null) {
    if (!workspaceId || !Array.isArray(updates) || updates.length === 0) {
      return [];
    }

    const executeBatch = async (client) => {
      const results = [];
      for (const item of updates) {
        if (!item || !item.id) {
          throw new Error('Each update in batchUpdateTaskOrders must contain a valid id.');
        }

        const data = {};
        if (item.status !== undefined) data.status = item.status;
        if (item.order !== undefined) data.order = item.order;

        const updated = await client.task.update({
          where: {
            workspaceId_id: {
              workspaceId,
              id: item.id,
            },
          },
          data,
          include: taskInclude,
        });
        results.push(updated);
      }
      return results;
    };

    if (tx) {
      return executeBatch(tx);
    }
    return this.db.$transaction((innerTx) => executeBatch(innerTx));
  }

  /**
   * Finds the highest numeric suffix in existing task keys for a given project.
   * Safe against malformed/legacy keys, numbers above 32-bit int, and numbers
   * above Number.MAX_SAFE_INTEGER.
   *
   * Preserves exact integer precision without floating-point loss by returning
   * a native JavaScript BigInt (e.g. 0n, 105n, 3000000000n, 9007199254740992000n).
   *
   * @param {string} workspaceId - Workspace ID (mandatory tenant scope)
   * @param {string} projectId - Project ID (mandatory project scope)
   * @param {Object} [tx=null] - Optional transaction client
   * @returns {Promise<bigint>} Highest numeric suffix as BigInt (0n if none)
   */
  async getMaxTaskKeyIndex(workspaceId, projectId, tx = null) {
    if (!workspaceId || !projectId) return 0n;
    const client = tx || this.db;

    const result = await client.$queryRaw`
      SELECT COALESCE(MAX(
        CASE 
          WHEN key ~ '^[A-Za-z0-9_-]+-[0-9]+$' 
          THEN CAST(SUBSTRING(key FROM '-([0-9]+)$') AS NUMERIC) 
          ELSE NULL 
        END
      ), 0)::numeric AS max_index
      FROM tasks
      WHERE workspace_id = ${workspaceId} 
        AND project_id = ${projectId} 
        AND key IS NOT NULL
    `;

    const raw = result[0]?.max_index;
    if (raw === null || raw === undefined) return 0n;

    let fixedStr;
    if (raw && typeof raw === 'object' && typeof raw.toFixed === 'function') {
      // Prisma Decimal.js instance:
      // Reject unexpected negative or fractional numbers
      if (typeof raw.isNegative === 'function' && raw.isNegative()) {
        return 0n;
      }
      if (typeof raw.isInteger === 'function' && !raw.isInteger()) {
        return 0n;
      }
      // toFixed(0) formats the Decimal as a fixed-point integer string,
      // preventing scientific/exponential notation (e.g. 1e+24) which BigInt cannot parse.
      fixedStr = raw.toFixed(0);
    } else {
      fixedStr = String(raw).trim();
    }

    // Must be strictly non-negative digits
    if (!/^\d+$/.test(fixedStr)) {
      return 0n;
    }

    try {
      const parsedBigInt = BigInt(fixedStr);
      return parsedBigInt >= 0n ? parsedBigInt : 0n;
    } catch {
      return 0n;
    }
  }
}

export const taskRepository = new TaskRepository();
export default taskRepository;
