export const PROJECT_STATUSES = Object.freeze({
  PLANNING: 'planning',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
});

export const TASK_STATUSES = Object.freeze({
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'in_review',
  DONE: 'done',
});

export const TASK_PRIORITIES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
});

export const ALL_PROJECT_STATUSES = Object.values(PROJECT_STATUSES);
export const ALL_TASK_STATUSES = Object.values(TASK_STATUSES);
export const ALL_TASK_PRIORITIES = Object.values(TASK_PRIORITIES);

