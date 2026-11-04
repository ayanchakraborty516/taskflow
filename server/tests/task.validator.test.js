import {
  createTaskValidator,
  updateTaskValidator,
  moveTaskValidator,
  batchReorderTasksValidator,
  toggleSubtaskValidator,
  listTasksValidator,
  taskDateSchema,
  isValidCalendarDate,
} from '../src/validators/task.validator.js';

describe('Task & Subtask Zod Validator Unit Tests', () => {
  describe('1. Date Validation & Normalization (taskDateSchema)', () => {
    it('accepts and normalizes valid YYYY-MM-DD calendar dates using UTC', () => {
      const parsed = taskDateSchema.parse('2026-11-20');
      expect(parsed).toBe('2026-11-20T00:00:00.000Z');
    });

    it('accepts leap year date (Feb 29 on leap year)', () => {
      expect(isValidCalendarDate('2024-02-29')).toBe(true);
      const parsed = taskDateSchema.parse('2024-02-29');
      expect(parsed).toBe('2024-02-29T00:00:00.000Z');
    });

    it('rejects invalid leap year date (Feb 29 on non-leap year)', () => {
      expect(isValidCalendarDate('2026-02-29')).toBe(false);
      expect(() => taskDateSchema.parse('2026-02-29')).toThrow();
    });

    it('rejects non-existent calendar dates (e.g. Feb 31, Nov 31)', () => {
      expect(isValidCalendarDate('2026-02-31')).toBe(false);
      expect(isValidCalendarDate('2026-11-31')).toBe(false);
      expect(isValidCalendarDate('2026-13-01')).toBe(false);
      expect(isValidCalendarDate('2026-00-10')).toBe(false);
      expect(() => taskDateSchema.parse('2026-02-31')).toThrow();
    });

    it('accepts and normalizes valid ISO 8601 date-time strings', () => {
      const iso = '2026-11-20T14:30:00.000Z';
      const parsed = taskDateSchema.parse(iso);
      expect(parsed).toBe(iso);
    });

    it('rejects arbitrary non-date strings and invalid timestamps', () => {
      expect(isValidCalendarDate('yesterday')).toBe(false);
      expect(isValidCalendarDate('2026/11/20')).toBe(false);
      expect(isValidCalendarDate('2026-11-20T25:00:00Z')).toBe(false);
      expect(() => taskDateSchema.parse('arbitrary-string')).toThrow();
    });

    it('preserves null when clearing date', () => {
      const parsed = taskDateSchema.parse(null);
      expect(parsed).toBeNull();
    });
  });

  describe('2. Create Task Validation (createTaskValidator)', () => {
    it('successfully parses valid task creation with canonical fields', () => {
      const payload = {
        title: 'Complete audit checklist',
        description: 'Detailed instructions',
        projectId: 'proj_123',
        status: 'todo',
        priority: 'high',
        assigneeId: 'user_456',
        dueDate: '2026-11-25',
        labels: ['Security', 'Audit'],
        order: 1,
        subtasks: [
          { title: 'Subtask 1', completed: false, order: 0 },
        ],
      };

      const result = createTaskValidator.body.parse(payload);
      expect(result.title).toBe('Complete audit checklist');
      expect(result.projectId).toBe('proj_123');
      expect(result.project).toBe('proj_123');
      expect(result.assigneeId).toBe('user_456');
      expect(result.assignee).toBe('user_456');
      expect(result.status).toBe('todo');
      expect(result.priority).toBe('high');
      expect(result.dueDate).toBe('2026-11-25T00:00:00.000Z');
      expect(result.labels).toEqual(['Security', 'Audit']);
      expect(result.subtasks.length).toBe(1);
      expect(result.subtasks[0].title).toBe('Subtask 1');
    });

    it('accepts frontend alias "project" and normalizes to projectId and project', () => {
      const payload = {
        title: 'Frontend Task',
        project: 'proj_front_1',
      };

      const result = createTaskValidator.body.parse(payload);
      expect(result.projectId).toBe('proj_front_1');
      expect(result.project).toBe('proj_front_1');
    });

    it('accepts frontend alias "assignee" and normalizes to assigneeId and assignee', () => {
      const payload = {
        title: 'Assigned Task',
        projectId: 'proj_1',
        assignee: 'user_front_1',
      };

      const result = createTaskValidator.body.parse(payload);
      expect(result.assigneeId).toBe('user_front_1');
      expect(result.assignee).toBe('user_front_1');
    });

    it('accepts matching aliases provided simultaneously', () => {
      const payload = {
        title: 'Matching Aliases',
        project: 'proj_same',
        projectId: 'proj_same',
        assignee: 'user_same',
        assigneeId: 'user_same',
      };

      const result = createTaskValidator.body.parse(payload);
      expect(result.projectId).toBe('proj_same');
      expect(result.assigneeId).toBe('user_same');
    });

    it('rejects conflicting project and projectId aliases', () => {
      const payload = {
        title: 'Conflicting Project Task',
        project: 'proj_AAA',
        projectId: 'proj_BBB',
      };

      expect(() => createTaskValidator.body.parse(payload)).toThrow(
        /Conflicting project and projectId values provided/
      );
    });

    it('rejects conflicting assignee and assigneeId aliases', () => {
      const payload = {
        title: 'Conflicting Assignee Task',
        projectId: 'proj_1',
        assignee: 'user_AAA',
        assigneeId: 'user_BBB',
      };

      expect(() => createTaskValidator.body.parse(payload)).toThrow(
        /Conflicting assignee and assigneeId values provided/
      );
    });

    it('rejects missing or empty title', () => {
      expect(() =>
        createTaskValidator.body.parse({
          title: '',
          projectId: 'proj_1',
        })
      ).toThrow(/Task title is required/);

      expect(() =>
        createTaskValidator.body.parse({
          title: '   ',
          projectId: 'proj_1',
        })
      ).toThrow(/Task title is required/);
    });

    it('rejects missing project identifier (neither project nor projectId)', () => {
      expect(() =>
        createTaskValidator.body.parse({
          title: 'Orphan Task',
        })
      ).toThrow(/Project ID is required/);
    });

    it('rejects invalid status and priority enum values', () => {
      expect(() =>
        createTaskValidator.body.parse({
          title: 'Bad Status Task',
          projectId: 'proj_1',
          status: 'invalid_status_xyz',
        })
      ).toThrow(/Status must be one of/);

      expect(() =>
        createTaskValidator.body.parse({
          title: 'Bad Priority Task',
          projectId: 'proj_1',
          priority: 'critical_super_urgent',
        })
      ).toThrow(/Priority must be one of/);
    });

    it('handles explicit null assignee and null dueDate', () => {
      const result = createTaskValidator.body.parse({
        title: 'Unassigned Task',
        projectId: 'proj_1',
        assignee: null,
        dueDate: null,
      });

      expect(result.assigneeId).toBeNull();
      expect(result.assignee).toBeNull();
      expect(result.dueDate).toBeNull();
    });

    it('rejects invalid labels (empty label string or too long)', () => {
      expect(() =>
        createTaskValidator.body.parse({
          title: 'Invalid Label Task',
          projectId: 'proj_1',
          labels: [''],
        })
      ).toThrow(/Label cannot be empty/);

      expect(() =>
        createTaskValidator.body.parse({
          title: 'Excessive Labels Task',
          projectId: 'proj_1',
          labels: Array(25).fill('Tag'),
        })
      ).toThrow(/Cannot exceed 20 labels/);
    });

    it('validates subtasks array inside create task payload', () => {
      const result = createTaskValidator.body.parse({
        title: 'Task with Subtasks',
        projectId: 'proj_1',
        subtasks: [
          { title: 'Subtask A', completed: true },
          { _id: 'legacy_sub_1', title: 'Subtask B' },
        ],
      });

      expect(result.subtasks.length).toBe(2);
      expect(result.subtasks[0].title).toBe('Subtask A');
      expect(result.subtasks[0].completed).toBe(true);
      expect(result.subtasks[0].order).toBe(0);
      expect(result.subtasks[1].id).toBe('legacy_sub_1');
      expect(result.subtasks[1].completed).toBe(false);
    });

    it('rejects subtask with empty title', () => {
      expect(() =>
        createTaskValidator.body.parse({
          title: 'Task with Bad Subtask',
          projectId: 'proj_1',
          subtasks: [{ title: '   ' }],
        })
      ).toThrow(/Subtask title cannot be empty/);
    });
  });

  describe('3. Update Task Validation (updateTaskValidator)', () => {
    it('preserves omitted fields as undefined during partial updates', () => {
      const parsed = updateTaskValidator.body.parse({
        status: 'in_progress',
      });

      expect(parsed.status).toBe('in_progress');
      expect(parsed.title).toBeUndefined();
      expect(parsed.description).toBeUndefined();
      expect(parsed.projectId).toBeUndefined();
      expect(parsed.assigneeId).toBeUndefined();
      expect(parsed.dueDate).toBeUndefined();
    });

    it('preserves explicit null to unassign user and clear due date', () => {
      const parsed = updateTaskValidator.body.parse({
        assignee: null,
        dueDate: null,
      });

      expect(parsed.assigneeId).toBeNull();
      expect(parsed.assignee).toBeNull();
      expect(parsed.dueDate).toBeNull();
    });

    it('validates params.id route parameter', () => {
      expect(() =>
        updateTaskValidator.params.parse({ id: '' })
      ).toThrow(/Task ID is required/);

      const params = updateTaskValidator.params.parse({ id: 'task_123' });
      expect(params.id).toBe('task_123');
    });

    it('rejects conflicting aliases in update payload', () => {
      expect(() =>
        updateTaskValidator.body.parse({
          assignee: 'u1',
          assigneeId: 'u2',
        })
      ).toThrow(/Conflicting assignee and assigneeId values provided/);
    });
  });

  describe('4. Move Task Validation (moveTaskValidator)', () => {
    it('status-only movement leaves newOrder and order undefined', () => {
      const params = moveTaskValidator.params.parse({ id: 'task_abc' });
      const body = moveTaskValidator.body.parse({ status: 'done' });

      expect(params.id).toBe('task_abc');
      expect(body.status).toBe('done');
      expect(body.newOrder).toBeUndefined();
      expect(body.order).toBeUndefined();
    });

    it('explicit newOrder 0 remains 0 and is not treated as omitted', () => {
      const body = moveTaskValidator.body.parse({ status: 'todo', newOrder: 0 });
      expect(body.status).toBe('todo');
      expect(body.newOrder).toBe(0);
      expect(body.order).toBe(0);
    });

    it('positive integer positions are accepted', () => {
      const bodyWithNewOrder = moveTaskValidator.body.parse({ status: 'in_review', newOrder: 3 });
      expect(bodyWithNewOrder.status).toBe('in_review');
      expect(bodyWithNewOrder.newOrder).toBe(3);
      expect(bodyWithNewOrder.order).toBe(3);

      const bodyWithOrder = moveTaskValidator.body.parse({ status: 'in_progress', order: 5 });
      expect(bodyWithOrder.status).toBe('in_progress');
      expect(bodyWithOrder.newOrder).toBe(5);
      expect(bodyWithOrder.order).toBe(5);
    });

    it('rejects negative positions', () => {
      expect(() =>
        moveTaskValidator.body.parse({ status: 'done', newOrder: -1 })
      ).toThrow(/newOrder cannot be negative/);

      expect(() =>
        moveTaskValidator.body.parse({ status: 'done', order: -5 })
      ).toThrow(/order cannot be negative/);
    });

    it('rejects non-integer positions and non-numeric types', () => {
      expect(() =>
        moveTaskValidator.body.parse({ status: 'done', newOrder: 2.5 })
      ).toThrow(/newOrder must be an integer/);

      expect(() =>
        moveTaskValidator.body.parse({ status: 'done', order: 'top' })
      ).toThrow(/order must be a number/);
    });

    it('rejects invalid status enum value', () => {
      expect(() =>
        moveTaskValidator.body.parse({ status: 'invalid_status' })
      ).toThrow(/Status must be one of/);
    });

    it('rejects conflicting newOrder and order values', () => {
      expect(() =>
        moveTaskValidator.body.parse({ status: 'done', newOrder: 1, order: 2 })
      ).toThrow(/Conflicting newOrder and order values provided/);
    });
  });

  describe('5. Batch Reorder Tasks Validation (batchReorderTasksValidator)', () => {
    it('validates batch reorder array with id and order', () => {
      const body = batchReorderTasksValidator.body.parse({
        tasks: [
          { id: 't1', status: 'in_progress', order: 0 },
          { _id: 't2', status: 'in_progress', order: 1 },
        ],
      });

      expect(body.tasks.length).toBe(2);
      expect(body.tasks[0].id).toBe('t1');
      expect(body.tasks[1].id).toBe('t2');
    });

    it('rejects empty tasks array in batch reorder', () => {
      expect(() =>
        batchReorderTasksValidator.body.parse({ tasks: [] })
      ).toThrow(/At least one task must be provided/);
    });
  });

  describe('6. Toggle Subtask Validation (toggleSubtaskValidator)', () => {
    it('validates both task id and subtaskId route params', () => {
      const params = toggleSubtaskValidator.params.parse({
        id: 'task_1',
        subtaskId: 'sub_1',
      });

      expect(params.id).toBe('task_1');
      expect(params.subtaskId).toBe('sub_1');
    });

    it('rejects empty subtaskId or empty taskId', () => {
      expect(() =>
        toggleSubtaskValidator.params.parse({ id: 'task_1', subtaskId: '' })
      ).toThrow(/Subtask ID is required/);
    });
  });

  describe('7. List Tasks Query Validation (listTasksValidator)', () => {
    it('validates and normalizes full list query parameters', () => {
      const query = {
        project: 'proj_123',
        status: 'todo',
        priority: 'high',
        assignee: 'user_456',
        myTasks: 'true',
        search: 'biometric',
        sort: 'dueDate',
        page: '2',
        limit: '25',
      };

      const result = listTasksValidator.query.parse(query);
      expect(result.project).toBe('proj_123');
      expect(result.projectId).toBe('proj_123');
      expect(result.status).toBe('todo');
      expect(result.priority).toBe('high');
      expect(result.assignee).toBe('user_456');
      expect(result.myTasks).toBe(true);
      expect(result.search).toBe('biometric');
      expect(result.sort).toBe('dueDate');
      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
    });

    it('normalizes "all" status and priority to undefined', () => {
      const result = listTasksValidator.query.parse({
        status: 'all',
        priority: 'all',
      });

      expect(result.status).toBeUndefined();
      expect(result.priority).toBeUndefined();
    });

    it('rejects invalid status filter in query', () => {
      expect(() =>
        listTasksValidator.query.parse({
          status: 'unknown_filter',
        })
      ).toThrow(/Status must be one of/);
    });

    it('rejects conflicting project aliases in query', () => {
      expect(() =>
        listTasksValidator.query.parse({
          project: 'proj_A',
          projectId: 'proj_B',
        })
      ).toThrow(/Conflicting project and projectId query parameters provided/);
    });
  });
});

