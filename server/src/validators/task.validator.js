import { z } from 'zod';
import { ALL_TASK_STATUSES, ALL_TASK_PRIORITIES } from '../constants/statuses.constant.js';

// -----------------------------------------------------------------------------
// Date Validation Helper
// -----------------------------------------------------------------------------

/**
 * Validates calendar date integrity for YYYY-MM-DD or ISO 8601 date-time strings.
 * Guarantees zero timezone-dependent shifts by utilizing UTC calendar arithmetic.
 */
export const isValidCalendarDate = (str) => {
  if (typeof str !== 'string') return false;

  // Format 1: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [yearStr, monthStr, dayStr] = str.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if (year < 1970 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  // Format 2: ISO 8601 Date-Time string (e.g. 2026-11-20T10:00:00.000Z)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/i.test(str)) {
    const date = new Date(str);
    if (isNaN(date.getTime())) return false;

    const datePart = str.split('T')[0];
    const [yearStr, monthStr, dayStr] = datePart.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if (year < 1970 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    const checkDate = new Date(Date.UTC(year, month - 1, day));
    return (
      checkDate.getUTCFullYear() === year &&
      checkDate.getUTCMonth() === month - 1 &&
      checkDate.getUTCDate() === day
    );
  }

  return false;
};

/**
 * Normalizes valid calendar dates to ISO 8601 strings.
 */
export const normalizeDate = (val) => {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return val.toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [yearStr, monthStr, dayStr] = val.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    return new Date(Date.UTC(year, month - 1, day)).toISOString();
  }
  return new Date(val).toISOString();
};

export const taskDateSchema = z
  .union([
    z.string().refine(isValidCalendarDate, {
      message: 'Invalid date format. Expected YYYY-MM-DD or valid ISO 8601 date-time string.',
    }),
    z.date(),
    z.null(),
  ])
  .transform(normalizeDate);

// -----------------------------------------------------------------------------
// Subtask & Label Sub-schemas
// -----------------------------------------------------------------------------

export const subtaskInputSchema = z
  .object({
    id: z.string().trim().min(1).max(50).optional(),
    _id: z.string().trim().min(1).max(50).optional(),
    title: z
      .string({ required_error: 'Subtask title is required' })
      .trim()
      .min(1, 'Subtask title cannot be empty')
      .max(200, 'Subtask title cannot exceed 200 characters'),
    completed: z.boolean().optional().default(false),
    order: z
      .number({ invalid_type_error: 'Subtask order must be a number' })
      .int('Subtask order must be an integer')
      .min(0, 'Subtask order cannot be negative')
      .optional()
      .default(0),
  })
  .transform((data) => ({
    id: data.id || data._id,
    title: data.title,
    completed: Boolean(data.completed),
    order: data.order,
  }));

export const taskLabelsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'Label cannot be empty')
      .max(50, 'Label cannot exceed 50 characters')
  )
  .max(20, 'Cannot exceed 20 labels');

// -----------------------------------------------------------------------------
// 1. Create Task Validator
// -----------------------------------------------------------------------------

export const createTaskSchema = z
  .object({
    title: z
      .string({ required_error: 'Task title is required' })
      .trim()
      .min(1, 'Task title is required')
      .max(200, 'Task title cannot exceed 200 characters'),
    description: z
      .string()
      .trim()
      .max(10000, 'Description cannot exceed 10000 characters')
      .optional()
      .default(''),
    project: z.string().trim().min(1, 'Project ID cannot be empty').max(50).optional(),
    projectId: z.string().trim().min(1, 'Project ID cannot be empty').max(50).optional(),
    status: z
      .enum(ALL_TASK_STATUSES, {
        errorMap: () => ({ message: `Status must be one of: ${ALL_TASK_STATUSES.join(', ')}` }),
      })
      .optional()
      .default('todo'),
    priority: z
      .enum(ALL_TASK_PRIORITIES, {
        errorMap: () => ({ message: `Priority must be one of: ${ALL_TASK_PRIORITIES.join(', ')}` }),
      })
      .optional()
      .default('medium'),
    assignee: z.string().trim().min(1, 'Assignee ID cannot be empty').max(50).nullable().optional(),
    assigneeId: z.string().trim().min(1, 'Assignee ID cannot be empty').max(50).nullable().optional(),
    dueDate: taskDateSchema.optional().nullable(),
    labels: taskLabelsSchema.optional().default([]),
    order: z
      .number({ invalid_type_error: 'Order must be a number' })
      .int('Order must be an integer')
      .min(0, 'Order cannot be negative')
      .optional()
      .default(0),
    subtasks: z
      .array(subtaskInputSchema)
      .max(100, 'Cannot exceed 100 subtasks')
      .optional()
      .default([]),
  })
  .superRefine((data, ctx) => {
    // 1. Project alias check
    if (!data.project && !data.projectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Project ID is required (provide project or projectId)',
        path: ['projectId'],
      });
    } else if (data.project && data.projectId && data.project !== data.projectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Conflicting project and projectId values provided',
        path: ['projectId'],
      });
    }

    // 2. Assignee alias check
    if (
      data.assignee !== undefined &&
      data.assigneeId !== undefined &&
      data.assignee !== data.assigneeId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Conflicting assignee and assigneeId values provided',
        path: ['assigneeId'],
      });
    }
  })
  .transform((data) => {
    const resolvedProjectId = data.projectId || data.project;
    let resolvedAssigneeId = null;
    if (data.assigneeId !== undefined) {
      resolvedAssigneeId = data.assigneeId;
    } else if (data.assignee !== undefined) {
      resolvedAssigneeId = data.assignee;
    }

    return {
      title: data.title,
      description: data.description,
      projectId: resolvedProjectId,
      project: resolvedProjectId,
      status: data.status,
      priority: data.priority,
      assigneeId: resolvedAssigneeId,
      assignee: resolvedAssigneeId,
      dueDate: data.dueDate ?? null,
      labels: data.labels,
      order: data.order,
      subtasks: data.subtasks,
    };
  });

export const createTaskValidator = {
  body: createTaskSchema,
};

// -----------------------------------------------------------------------------
// 2. Update Task Validator
// -----------------------------------------------------------------------------

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Task title cannot be empty')
      .max(200, 'Task title cannot exceed 200 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(10000, 'Description cannot exceed 10000 characters')
      .optional(),
    project: z.string().trim().min(1, 'Project ID cannot be empty').max(50).optional(),
    projectId: z.string().trim().min(1, 'Project ID cannot be empty').max(50).optional(),
    status: z
      .enum(ALL_TASK_STATUSES, {
        errorMap: () => ({ message: `Status must be one of: ${ALL_TASK_STATUSES.join(', ')}` }),
      })
      .optional(),
    priority: z
      .enum(ALL_TASK_PRIORITIES, {
        errorMap: () => ({ message: `Priority must be one of: ${ALL_TASK_PRIORITIES.join(', ')}` }),
      })
      .optional(),
    assignee: z.string().trim().min(1, 'Assignee ID cannot be empty').max(50).nullable().optional(),
    assigneeId: z.string().trim().min(1, 'Assignee ID cannot be empty').max(50).nullable().optional(),
    dueDate: taskDateSchema.optional().nullable(),
    labels: taskLabelsSchema.optional(),
    order: z
      .number({ invalid_type_error: 'Order must be a number' })
      .int('Order must be an integer')
      .min(0, 'Order cannot be negative')
      .optional(),
    subtasks: z
      .array(subtaskInputSchema)
      .max(100, 'Cannot exceed 100 subtasks')
      .optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Project alias check
    if (data.project && data.projectId && data.project !== data.projectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Conflicting project and projectId values provided',
        path: ['projectId'],
      });
    }

    // 2. Assignee alias check
    if (
      data.assignee !== undefined &&
      data.assigneeId !== undefined &&
      data.assignee !== data.assigneeId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Conflicting assignee and assigneeId values provided',
        path: ['assigneeId'],
      });
    }
  })
  .transform((data) => {
    const result = {};

    if (data.title !== undefined) result.title = data.title;
    if (data.description !== undefined) result.description = data.description;

    const resolvedProjectId = data.projectId !== undefined ? data.projectId : data.project;
    if (resolvedProjectId !== undefined) {
      result.projectId = resolvedProjectId;
      result.project = resolvedProjectId;
    }

    if (data.status !== undefined) result.status = data.status;
    if (data.priority !== undefined) result.priority = data.priority;

    const resolvedAssigneeId = data.assigneeId !== undefined ? data.assigneeId : data.assignee;
    if (resolvedAssigneeId !== undefined) {
      result.assigneeId = resolvedAssigneeId;
      result.assignee = resolvedAssigneeId;
    }

    if (data.dueDate !== undefined) result.dueDate = data.dueDate;
    if (data.labels !== undefined) result.labels = data.labels;
    if (data.order !== undefined) result.order = data.order;
    if (data.subtasks !== undefined) result.subtasks = data.subtasks;

    return result;
  });

export const updateTaskValidator = {
  params: z.object({
    id: z.string().trim().min(1, 'Task ID is required'),
  }),
  body: updateTaskSchema,
};

// -----------------------------------------------------------------------------
// 3. Move Task Validator (Quick Shift / Drag-and-Drop)
// -----------------------------------------------------------------------------

export const moveTaskValidator = {
  params: z.object({
    id: z.string().trim().min(1, 'Task ID is required'),
  }),
  body: z
    .object({
      status: z.enum(ALL_TASK_STATUSES, {
        errorMap: () => ({ message: `Status must be one of: ${ALL_TASK_STATUSES.join(', ')}` }),
      }),
      newOrder: z
        .number({ invalid_type_error: 'newOrder must be a number' })
        .int('newOrder must be an integer')
        .min(0, 'newOrder cannot be negative')
        .optional(),
      order: z
        .number({ invalid_type_error: 'order must be a number' })
        .int('order must be an integer')
        .min(0, 'order cannot be negative')
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (
        data.newOrder !== undefined &&
        data.order !== undefined &&
        data.newOrder !== data.order
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Conflicting newOrder and order values provided',
          path: ['newOrder'],
        });
      }
    })
    .transform((data) => {
      const finalOrder = data.newOrder !== undefined ? data.newOrder : data.order;
      const result = {
        status: data.status,
      };
      if (finalOrder !== undefined) {
        result.newOrder = finalOrder;
        result.order = finalOrder;
      }
      return result;
    }),
};

// Alias for backward compatibility with earlier scaffolding
export const reorderTaskValidator = moveTaskValidator;

// -----------------------------------------------------------------------------
// 4. Batch Reorder Tasks Validator
// -----------------------------------------------------------------------------

export const batchReorderTasksValidator = {
  body: z.object({
    tasks: z
      .array(
        z
          .object({
            id: z.string().trim().min(1, 'Task ID cannot be empty').optional(),
            _id: z.string().trim().min(1, 'Task ID cannot be empty').optional(),
            status: z.enum(ALL_TASK_STATUSES).optional(),
            order: z
              .number({ invalid_type_error: 'Order must be a number' })
              .int('Order must be an integer')
              .min(0, 'Order cannot be negative')
              .optional(),
          })
          .superRefine((item, ctx) => {
            if (!item.id && !item._id) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Task ID is required (provide id or _id)',
                path: ['id'],
              });
            }
          })
          .transform((item) => ({
            id: item.id || item._id,
            status: item.status,
            order: item.order,
          }))
      )
      .min(1, 'At least one task must be provided for batch reorder'),
  }),
};

// -----------------------------------------------------------------------------
// 5. Toggle Subtask Validator
// -----------------------------------------------------------------------------

export const toggleSubtaskValidator = {
  params: z.object({
    id: z.string().trim().min(1, 'Task ID is required'),
    subtaskId: z.string().trim().min(1, 'Subtask ID is required'),
  }),
};

// -----------------------------------------------------------------------------
// 6. Subtask Standalone Creation & Update Validators
// -----------------------------------------------------------------------------

export const createSubtaskValidator = {
  params: z.object({
    id: z.string().trim().min(1, 'Task ID is required'),
  }),
  body: z.object({
    title: z
      .string({ required_error: 'Subtask title is required' })
      .trim()
      .min(1, 'Subtask title cannot be empty')
      .max(200, 'Subtask title cannot exceed 200 characters'),
    completed: z.boolean().optional().default(false),
    order: z
      .number({ invalid_type_error: 'Subtask order must be a number' })
      .int('Subtask order must be an integer')
      .min(0, 'Subtask order cannot be negative')
      .optional()
      .default(0),
  }),
};

export const updateSubtaskValidator = {
  params: z.object({
    id: z.string().trim().min(1, 'Task ID is required'),
    subtaskId: z.string().trim().min(1, 'Subtask ID is required'),
  }),
  body: z.object({
    title: z.string().trim().min(1, 'Subtask title cannot be empty').max(200).optional(),
    completed: z.boolean().optional(),
    order: z.number().int('Order must be an integer').min(0, 'Order cannot be negative').optional(),
  }),
};

// -----------------------------------------------------------------------------
// 7. Route Parameter Validators
// -----------------------------------------------------------------------------

export const getTaskValidator = {
  params: z.object({
    id: z.string().trim().min(1, 'Task ID is required'),
  }),
};

export const deleteTaskValidator = {
  params: z.object({
    id: z.string().trim().min(1, 'Task ID is required'),
  }),
};

// -----------------------------------------------------------------------------
// 8. List Tasks Query Validator
// -----------------------------------------------------------------------------

export const listTasksValidator = {
  query: z
    .object({
      project: z.string().trim().min(1).optional(),
      projectId: z.string().trim().min(1).optional(),
      status: z.string().trim().optional(),
      priority: z.string().trim().optional(),
      assignee: z.string().trim().min(1).optional(),
      assigneeId: z.string().trim().min(1).optional(),
      myTasks: z.enum(['true', 'false', '1', '0']).optional(),
      search: z.string().trim().optional(),
      sort: z.enum(['dueDate', 'priority', 'title', 'created', 'order']).optional(),
      page: z.string().regex(/^\d+$/, 'Page must be a valid number').transform(Number).optional(),
      limit: z.string().regex(/^\d+$/, 'Limit must be a valid number').transform(Number).optional(),
    })
    .superRefine((data, ctx) => {
      // Validate status filter
      if (data.status && data.status !== 'all' && !ALL_TASK_STATUSES.includes(data.status)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Status must be one of: ${ALL_TASK_STATUSES.join(', ')}, or 'all'`,
          path: ['status'],
        });
      }

      // Validate priority filter
      if (data.priority && data.priority !== 'all' && !ALL_TASK_PRIORITIES.includes(data.priority)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Priority must be one of: ${ALL_TASK_PRIORITIES.join(', ')}, or 'all'`,
          path: ['priority'],
        });
      }

      // Check conflicting project query aliases
      if (data.project && data.projectId && data.project !== data.projectId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Conflicting project and projectId query parameters provided',
          path: ['project'],
        });
      }

      // Check conflicting assignee query aliases
      if (data.assignee && data.assigneeId && data.assignee !== data.assigneeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Conflicting assignee and assigneeId query parameters provided',
          path: ['assignee'],
        });
      }
    })
    .transform((data) => {
      const resolvedProjectId = data.projectId || data.project;
      const resolvedAssigneeId = data.assigneeId || data.assignee;
      return {
        project: resolvedProjectId,
        projectId: resolvedProjectId,
        status: data.status === 'all' ? undefined : data.status,
        priority: data.priority === 'all' ? undefined : data.priority,
        assignee: resolvedAssigneeId,
        assigneeId: resolvedAssigneeId,
        myTasks: data.myTasks === 'true' || data.myTasks === '1',
        search: data.search,
        sort: data.sort,
        page: data.page,
        limit: data.limit,
      };
    }),
};

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export default {
  createTaskValidator,
  updateTaskValidator,
  moveTaskValidator,
  reorderTaskValidator,
  batchReorderTasksValidator,
  toggleSubtaskValidator,
  createSubtaskValidator,
  updateSubtaskValidator,
  getTaskValidator,
  deleteTaskValidator,
  listTasksValidator,
};
