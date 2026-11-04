import prisma, {
  connectDatabase,
  disconnectDatabase,
} from '../src/database/prisma.client.js';
import { cleanDatabase, createTestUser, createTestWorkspace } from '../src/database/test-helper.js';
import { runInTransaction } from '../src/database/transaction.util.js';
import taskRepository, { AmbiguousTaskKeyError } from '../src/repositories/task.repository.js';
import subtaskRepository from '../src/repositories/subtask.repository.js';

describe('Task and Subtask Repository Integration Tests', () => {
  let wsA, wsB;
  let userA, userB, userA2;
  let projA1, projA2, projB1;

  beforeAll(async () => {
    await connectDatabase();
    await cleanDatabase();

    // Create users
    userA = await createTestUser(prisma, { name: 'Alice Admin', email: 'alice@alpha.dev' });
    userA2 = await createTestUser(prisma, { name: 'Aaron Assignee', email: 'aaron@alpha.dev' });
    userB = await createTestUser(prisma, { name: 'Bob Outsider', email: 'bob@beta.dev' });

    // Create workspaces
    wsA = await createTestWorkspace(prisma, userA.id, { name: 'Alpha Workspace' });
    wsB = await createTestWorkspace(prisma, userB.id, { name: 'Beta Workspace' });

    // Add userA2 as member of wsA
    await prisma.workspaceMember.create({
      data: {
        workspaceId: wsA.id,
        userId: userA2.id,
        role: 'Member',
      },
    });

    // Create projects
    projA1 = await prisma.project.create({
      data: {
        workspaceId: wsA.id,
        name: 'Project Alpha One',
        key: 'AONE',
      },
    });

    projA2 = await prisma.project.create({
      data: {
        workspaceId: wsA.id,
        name: 'Project Alpha Two',
        key: 'ATWO',
      },
    });

    projB1 = await prisma.project.create({
      data: {
        workspaceId: wsB.id,
        name: 'Project Beta One',
        key: 'BONE',
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  describe('1. Task Repository Core CRUD', () => {
    let createdTask;

    it('creates a task with relations, labels, and initial subtasks', async () => {
      createdTask = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: projA1.id,
        creatorId: userA.id,
        title: 'Implement OAuth PKCE flow',
        description: 'Ensure mobile client uses PKCE for secure authentication',
        key: 'AONE-101',
        status: 'todo',
        priority: 'high',
        assigneeId: userA2.id,
        dueDate: '2026-11-20T00:00:00.000Z',
        labels: ['Auth', 'Security'],
        order: 0,
        subtasks: [
          { title: 'Add code_verifier generator', completed: false, order: 0 },
          { title: 'Verify SHA-256 challenge', completed: true, order: 1 },
        ],
      });

      expect(createdTask).toBeDefined();
      expect(createdTask.id).toBeDefined();
      expect(createdTask.workspaceId).toBe(wsA.id);
      expect(createdTask.projectId).toBe(projA1.id);
      expect(createdTask.creatorId).toBe(userA.id);
      expect(createdTask.assigneeId).toBe(userA2.id);
      expect(createdTask.title).toBe('Implement OAuth PKCE flow');
      expect(createdTask.key).toBe('AONE-101');
      expect(createdTask.status).toBe('todo');
      expect(createdTask.priority).toBe('high');
      expect(createdTask.labels).toEqual(['Auth', 'Security']);

      // Relations loaded
      expect(createdTask.project).toBeDefined();
      expect(createdTask.project.name).toBe('Project Alpha One');
      expect(createdTask.assignee).toBeDefined();
      expect(createdTask.assignee.email).toBe('aaron@alpha.dev');
      expect(createdTask.creator).toBeDefined();
      expect(createdTask.creator.email).toBe('alice@alpha.dev');
      expect(createdTask.subtasks.length).toBe(2);
      expect(createdTask.subtasks[0].title).toBe('Add code_verifier generator');
      expect(createdTask.subtasks[1].completed).toBe(true);
    });

    it('retrieves task by ID strictly scoped to workspace', async () => {
      const found = await taskRepository.findById(createdTask.id, wsA.id);
      expect(found).not.toBeNull();
      expect(found.id).toBe(createdTask.id);
      expect(found.project.key).toBe('AONE');
      expect(found.assignee.name).toBe('Aaron Assignee');
    });

    it('retrieves task by key strictly scoped to workspace and project (case-insensitive fallback)', async () => {
      // Must supply projectId
      const found = await taskRepository.findByKey('aone-101', wsA.id, projA1.id);
      expect(found).not.toBeNull();
      expect(found.id).toBe(createdTask.id);
      expect(found.key).toBe('AONE-101');

      // Also supports options object parameter
      const foundViaOptions = await taskRepository.findByKey({
        key: 'AONE-101',
        workspaceId: wsA.id,
        projectId: projA1.id,
      });
      expect(foundViaOptions).not.toBeNull();
      expect(foundViaOptions.id).toBe(createdTask.id);
    });

    it('rejects findByKey without projectId (returns null to prevent ambiguous cross-project matches)', async () => {
      const result = await taskRepository.findByKey('aone-101', wsA.id);
      expect(result).toBeNull();
    });

    it('disambiguates identical task keys across different projects in the same workspace', async () => {
      const sharedProj1 = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Shared Key Proj 1',
          key: 'SH1',
        },
      });

      const sharedProj2 = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Shared Key Proj 2',
          key: 'SH2',
        },
      });

      const taskProj1 = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: sharedProj1.id,
        creatorId: userA.id,
        title: 'Project 1 Task with shared key',
        key: 'SHARED-1',
      });

      const taskProj2 = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: sharedProj2.id,
        creatorId: userA.id,
        title: 'Project 2 Task with shared key',
        key: 'SHARED-1',
      });

      expect(taskProj1.key).toBe('SHARED-1');
      expect(taskProj2.key).toBe('SHARED-1');

      // Disambiguates by projectId
      const foundProj1 = await taskRepository.findByKey('SHARED-1', wsA.id, sharedProj1.id);
      expect(foundProj1).not.toBeNull();
      expect(foundProj1.id).toBe(taskProj1.id);
      expect(foundProj1.projectId).toBe(sharedProj1.id);

      const foundProj2 = await taskRepository.findByKey('shared-1', wsA.id, sharedProj2.id);
      expect(foundProj2).not.toBeNull();
      expect(foundProj2.id).toBe(taskProj2.id);
      expect(foundProj2.projectId).toBe(sharedProj2.id);

      // Wrong workspace returns null
      const wrongWs = await taskRepository.findByKey('SHARED-1', wsB.id, sharedProj1.id);
      expect(wrongWs).toBeNull();

      // Wrong project returns null
      const wrongProj = await taskRepository.findByKey('SHARED-1', wsA.id, 'non_existent_proj');
      expect(wrongProj).toBeNull();
    });

    it('resolves deterministic exact match when multiple case-variant keys exist in a project', async () => {
      const caseProj = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Case Variant Project',
          key: 'CASE',
        },
      });

      const uppercaseTask = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: caseProj.id,
        creatorId: userA.id,
        title: 'Uppercase Key Task',
        key: 'CASE-10',
      });

      const lowercaseTask = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: caseProj.id,
        creatorId: userA.id,
        title: 'Lowercase Key Task',
        key: 'case-10',
      });

      expect(uppercaseTask.id).not.toBe(lowercaseTask.id);

      // Exact 'CASE-10' lookup matches uppercaseTask
      const foundUpper = await taskRepository.findByKey('CASE-10', wsA.id, caseProj.id);
      expect(foundUpper).not.toBeNull();
      expect(foundUpper.id).toBe(uppercaseTask.id);
      expect(foundUpper.key).toBe('CASE-10');

      // Exact 'case-10' lookup matches lowercaseTask
      const foundLower = await taskRepository.findByKey('case-10', wsA.id, caseProj.id);
      expect(foundLower).not.toBeNull();
      expect(foundLower.id).toBe(lowercaseTask.id);
      expect(foundLower.key).toBe('case-10');

      // Ambiguous case-insensitive fallback: 'Case-10' has no exact match, but 2 case-insensitive matches
      await expect(
        taskRepository.findByKey('Case-10', wsA.id, caseProj.id)
      ).rejects.toThrow(AmbiguousTaskKeyError);

      await expect(
        taskRepository.findByKey('Case-10', wsA.id, caseProj.id)
      ).rejects.toMatchObject({
        code: 'AMBIGUOUS_TASK_KEY',
        matchCount: 2,
      });
    });

    it('resolves unique case-insensitive match when only one case variant exists', async () => {
      const singleProj = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Single Case Project',
          key: 'UNIQ',
        },
      });

      const task = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: singleProj.id,
        creatorId: userA.id,
        title: 'Single Task',
        key: 'UNIQ-99',
      });

      // No exact match for lowercase 'uniq-99', but exactly 1 case-insensitive match
      const found = await taskRepository.findByKey('uniq-99', wsA.id, singleProj.id);
      expect(found).not.toBeNull();
      expect(found.id).toBe(task.id);
      expect(found.key).toBe('UNIQ-99');
    });

    it('returns null when task key does not exist', async () => {
      const notFound = await taskRepository.findByKey('NONEXISTENT-999', wsA.id, projA1.id);
      expect(notFound).toBeNull();
    });

    it('updates task fields, labels, and replaces subtasks', async () => {
      const updated = await taskRepository.update(createdTask.id, wsA.id, {
        title: 'Implement OAuth PKCE & WebAuthn flow',
        status: 'in_progress',
        priority: 'urgent',
        labels: ['Auth', 'Security', 'Passkeys'],
        subtasks: [
          { title: 'Replaced subtask 1', completed: true, order: 0 },
        ],
      });

      expect(updated.title).toBe('Implement OAuth PKCE & WebAuthn flow');
      expect(updated.status).toBe('in_progress');
      expect(updated.priority).toBe('urgent');
      expect(updated.labels).toEqual(['Auth', 'Security', 'Passkeys']);
      expect(updated.subtasks.length).toBe(1);
      expect(updated.subtasks[0].title).toBe('Replaced subtask 1');
    });

    it('deletes a task strictly scoped to workspace and cascades its subtasks', async () => {
      const taskToDelete = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: projA1.id,
        creatorId: userA.id,
        title: 'Temporary task to delete',
        subtasks: [
          { title: 'Subtask 1' },
          { title: 'Subtask 2' },
        ],
      });

      const subtaskCountBefore = await prisma.subtask.count({
        where: { taskId: taskToDelete.id },
      });
      expect(subtaskCountBefore).toBe(2);

      await taskRepository.delete(taskToDelete.id, wsA.id);

      const foundAfter = await taskRepository.findById(taskToDelete.id, wsA.id);
      expect(foundAfter).toBeNull();

      const subtaskCountAfter = await prisma.subtask.count({
        where: { taskId: taskToDelete.id },
      });
      expect(subtaskCountAfter).toBe(0);
    });
  });

  describe('2. Listing, Filtering, Sorting, and Pagination', () => {
    beforeAll(async () => {
      // Create a set of varied tasks for filtering tests
      await taskRepository.create({
        workspaceId: wsA.id,
        projectId: projA1.id,
        creatorId: userA.id,
        title: 'Backend API routing',
        description: 'Express 5 route mounting',
        key: 'AONE-102',
        status: 'todo',
        priority: 'low',
        assigneeId: userA.id,
        dueDate: '2026-12-01T00:00:00.000Z',
        labels: ['Backend', 'Routing'],
        order: 1,
      });

      await taskRepository.create({
        workspaceId: wsA.id,
        projectId: projA1.id,
        creatorId: userA.id,
        title: 'Frontend Kanban DnD',
        description: 'dnd-kit drag and drop cards',
        key: 'AONE-103',
        status: 'in_progress',
        priority: 'medium',
        assigneeId: userA2.id,
        dueDate: '2026-11-15T00:00:00.000Z',
        labels: ['Frontend', 'Kanban'],
        order: 0,
      });

      await taskRepository.create({
        workspaceId: wsA.id,
        projectId: projA2.id,
        creatorId: userA.id,
        title: 'Design System Typography',
        description: 'Inter and JetBrains Mono styles',
        key: 'ATWO-101',
        status: 'done',
        priority: 'high',
        assigneeId: userA2.id,
        dueDate: '2026-11-10T00:00:00.000Z',
        labels: ['Design', 'UI'],
        order: 0,
      });
    });

    it('lists all tasks in workspace', async () => {
      const tasks = await taskRepository.listTasks({ workspaceId: wsA.id });
      expect(tasks.length).toBeGreaterThanOrEqual(4);
    });

    it('filters tasks by projectId', async () => {
      const projA2Tasks = await taskRepository.listTasks({
        workspaceId: wsA.id,
        projectId: projA2.id,
      });

      expect(projA2Tasks.length).toBe(1);
      expect(projA2Tasks[0].title).toBe('Design System Typography');
    });

    it('filters tasks by status', async () => {
      const inProgressTasks = await taskRepository.listTasks({
        workspaceId: wsA.id,
        status: 'in_progress',
      });

      for (const t of inProgressTasks) {
        expect(t.status).toBe('in_progress');
      }
    });

    it('filters tasks by priority', async () => {
      const lowPriorityTasks = await taskRepository.listTasks({
        workspaceId: wsA.id,
        priority: 'low',
      });

      expect(lowPriorityTasks.length).toBe(1);
      expect(lowPriorityTasks[0].title).toBe('Backend API routing');
    });

    it('filters tasks by assigneeId', async () => {
      const userA2Tasks = await taskRepository.listTasks({
        workspaceId: wsA.id,
        assigneeId: userA2.id,
      });

      for (const t of userA2Tasks) {
        expect(t.assigneeId).toBe(userA2.id);
      }
    });

    it('filters tasks with myTasks: true using userId', async () => {
      const myTasks = await taskRepository.listTasks({
        workspaceId: wsA.id,
        myTasks: true,
        userId: userA.id,
      });

      for (const t of myTasks) {
        expect(t.assigneeId).toBe(userA.id);
      }
    });

    it('searches tasks across title, key, description, and labels', async () => {
      const titleSearch = await taskRepository.listTasks({
        workspaceId: wsA.id,
        search: 'Kanban',
      });
      expect(titleSearch.some((t) => t.title.includes('Kanban'))).toBe(true);

      const labelSearch = await taskRepository.listTasks({
        workspaceId: wsA.id,
        search: 'Security',
      });
      expect(labelSearch.some((t) => t.labels.includes('Security'))).toBe(true);

      const keySearch = await taskRepository.listTasks({
        workspaceId: wsA.id,
        search: 'AONE-102',
      });
      expect(keySearch.length).toBe(1);
      expect(keySearch[0].key).toBe('AONE-102');
    });

    it('sorts tasks by dueDate asc', async () => {
      const sorted = await taskRepository.listTasks({
        workspaceId: wsA.id,
        sort: 'dueDate',
      });

      const dates = sorted.filter((t) => t.dueDate).map((t) => new Date(t.dueDate).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
      }
    });

    it('paginates task list and provides accurate count', async () => {
      const totalCount = await taskRepository.countTasks({ workspaceId: wsA.id });
      expect(totalCount).toBeGreaterThanOrEqual(4);

      const page1 = await taskRepository.listTasks({
        workspaceId: wsA.id,
        page: 1,
        limit: 2,
      });
      expect(page1.length).toBe(2);

      const page2 = await taskRepository.listTasks({
        workspaceId: wsA.id,
        page: 2,
        limit: 2,
      });
      expect(page2.length).toBe(2);

      // Verify no overlap between page 1 and page 2
      const page1Ids = page1.map((t) => t.id);
      const page2Ids = page2.map((t) => t.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    });
  });

  describe('3. Kanban Ordering & Task Movement', () => {
    it('getMaxOrder returns correct maximum order in column and -1 if empty', async () => {
      const emptyOrder = await taskRepository.getMaxOrder(wsA.id, projA1.id, 'done');
      expect(emptyOrder).toBe(-1);

      const todoMax = await taskRepository.getMaxOrder(wsA.id, projA1.id, 'todo');
      expect(todoMax).toBeGreaterThanOrEqual(0);
    });

    it('getTasksInColumn returns tasks sorted by order asc', async () => {
      const tasks = await taskRepository.getTasksInColumn(wsA.id, projA1.id, 'in_progress');
      for (let i = 1; i < tasks.length; i++) {
        expect(tasks[i].order).toBeGreaterThanOrEqual(tasks[i - 1].order);
      }
    });

    it('updateTaskOrderAndStatus modifies order and status in workspace', async () => {
      const task = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: projA1.id,
        creatorId: userA.id,
        title: 'Task to shift status',
        status: 'todo',
        order: 5,
      });

      const updated = await taskRepository.updateTaskOrderAndStatus(task.id, wsA.id, {
        status: 'in_review',
        order: 2,
      });

      expect(updated.status).toBe('in_review');
      expect(updated.order).toBe(2);
    });

    it('batchUpdateTaskOrders safely updates multiple task positions', async () => {
      const t1 = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: projA1.id,
        creatorId: userA.id,
        title: 'Batch Task 1',
        status: 'todo',
        order: 0,
      });

      const t2 = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: projA1.id,
        creatorId: userA.id,
        title: 'Batch Task 2',
        status: 'todo',
        order: 1,
      });

      const results = await taskRepository.batchUpdateTaskOrders(wsA.id, [
        { id: t1.id, status: 'done', order: 0 },
        { id: t2.id, status: 'done', order: 1 },
      ]);

      expect(results.length).toBe(2);
      expect(results[0].status).toBe('done');
      expect(results[0].order).toBe(0);
      expect(results[1].status).toBe('done');
      expect(results[1].order).toBe(1);
    });

    it('batchUpdateTaskOrders returns empty array for empty inputs', async () => {
      expect(await taskRepository.batchUpdateTaskOrders(wsA.id, [])).toEqual([]);
      expect(await taskRepository.batchUpdateTaskOrders(null, [{ id: '1' }])).toEqual([]);
    });

    it('batchUpdateTaskOrders throws and rolls back if an item belongs to another workspace or does not exist', async () => {
      const validTask = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: projA1.id,
        creatorId: userA.id,
        title: 'Rollback Batch Task',
        status: 'todo',
        order: 10,
      });

      await expect(
        taskRepository.batchUpdateTaskOrders(wsA.id, [
          { id: validTask.id, status: 'done', order: 99 },
          { id: 'non-existent-or-wsB-id', status: 'done', order: 100 },
        ])
      ).rejects.toMatchObject({
        code: 'P2025',
      });

      // Verify validTask was rolled back and not partially updated
      const taskAfter = await taskRepository.findById(validTask.id, wsA.id);
      expect(taskAfter.status).toBe('todo');
      expect(taskAfter.order).toBe(10);
    });
  });

  describe('4. Task Key Query Support (getMaxTaskKeyIndex)', () => {
    it('returns highest numeric suffix for project tasks as BigInt', async () => {
      const maxIndex = await taskRepository.getMaxTaskKeyIndex(wsA.id, projA1.id);
      expect(typeof maxIndex).toBe('bigint');
      expect(maxIndex).toBeGreaterThanOrEqual(103n);
    });

    it('returns 0n when project has no tasks with keys', async () => {
      const emptyProj = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Empty Key Project',
          key: 'EMPTY',
        },
      });

      const maxIndex = await taskRepository.getMaxTaskKeyIndex(wsA.id, emptyProj.id);
      expect(typeof maxIndex).toBe('bigint');
      expect(maxIndex).toBe(0n);
    });

    it('safely handles large numeric suffixes above 32-bit integer range (> 2,147,483,647)', async () => {
      const bigKeyProj = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Big Suffix Project',
          key: 'BIG',
        },
      });

      await taskRepository.create({
        workspaceId: wsA.id,
        projectId: bigKeyProj.id,
        creatorId: userA.id,
        title: 'Task with large numeric suffix',
        key: 'BIG-3000000000', // 3 billion > 2,147,483,647 (max 32-bit signed int)
      });

      const maxIndex = await taskRepository.getMaxTaskKeyIndex(wsA.id, bigKeyProj.id);
      expect(typeof maxIndex).toBe('bigint');
      expect(maxIndex).toBe(3000000000n);
    });

    it('preserves exact integer precision above Number.MAX_SAFE_INTEGER (> 9,007,199,254,740,991)', async () => {
      const hugeKeyProj = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Huge Key Project',
          key: 'HUGE',
        },
      });

      // 9,007,199,254,740,992,000 exceeds Number.MAX_SAFE_INTEGER
      const hugeSuffixStr = '9007199254740992000';
      await taskRepository.create({
        workspaceId: wsA.id,
        projectId: hugeKeyProj.id,
        creatorId: userA.id,
        title: 'Task with huge numeric suffix above MAX_SAFE_INTEGER',
        key: `HUGE-${hugeSuffixStr}`,
      });

      const maxIndex = await taskRepository.getMaxTaskKeyIndex(wsA.id, hugeKeyProj.id);
      expect(typeof maxIndex).toBe('bigint');
      expect(maxIndex).toBe(9007199254740992000n);

      // Verify exact calculation of next key without precision loss
      const nextIndex = (maxIndex + 1n).toString();
      expect(nextIndex).toBe('9007199254740992001');
    });

    it('safely handles values that Decimal.js normally displays in exponential notation (> 20 digits)', async () => {
      const expKeyProj = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Exponential Key Project',
          key: 'EXP',
        },
      });

      // 25 digits: Decimal.js toString() normally produces '1e+24' which BigInt() cannot parse directly
      const exponentialSuffix = '1000000000000000000000000';
      await taskRepository.create({
        workspaceId: wsA.id,
        projectId: expKeyProj.id,
        creatorId: userA.id,
        title: 'Task with 25-digit exponential suffix',
        key: `EXP-${exponentialSuffix}`,
      });

      const maxIndex = await taskRepository.getMaxTaskKeyIndex(wsA.id, expKeyProj.id);
      expect(typeof maxIndex).toBe('bigint');
      expect(maxIndex).toBe(1000000000000000000000000n);

      // Verify exact increment behavior
      const nextIndex = (maxIndex + 1n).toString();
      expect(nextIndex).toBe('1000000000000000000000001');
    });

    it('safely handles null keys and skips them', async () => {
      const nullKeyProj = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Null Key Project',
          key: 'NULLPROJ',
        },
      });

      await taskRepository.create({
        workspaceId: wsA.id,
        projectId: nullKeyProj.id,
        creatorId: userA.id,
        title: 'Task without key',
        key: null,
      });

      const maxIndex = await taskRepository.getMaxTaskKeyIndex(wsA.id, nullKeyProj.id);
      expect(typeof maxIndex).toBe('bigint');
      expect(maxIndex).toBe(0n);
    });

    it('handles legacy and malformed non-numeric keys safely without error', async () => {
      const legacyProj = await prisma.project.create({
        data: {
          workspaceId: wsA.id,
          name: 'Legacy Project',
          key: 'LEG',
        },
      });

      await taskRepository.create({
        workspaceId: wsA.id,
        projectId: legacyProj.id,
        creatorId: userA.id,
        title: 'Legacy string key task',
        key: 'LEG-SPECIAL',
      });

      await taskRepository.create({
        workspaceId: wsA.id,
        projectId: legacyProj.id,
        creatorId: userA.id,
        title: 'Numeric key task',
        key: 'LEG-105',
      });

      const maxIndex = await taskRepository.getMaxTaskKeyIndex(wsA.id, legacyProj.id);
      expect(typeof maxIndex).toBe('bigint');
      expect(maxIndex).toBe(105n);
    });
  });

  describe('5. Multi-Tenant Database Isolation Safeguards', () => {
    let wsBTask;

    beforeAll(async () => {
      wsBTask = await taskRepository.create({
        workspaceId: wsB.id,
        projectId: projB1.id,
        creatorId: userB.id,
        title: 'Workspace B Secret Task',
        key: 'BONE-101',
      });
    });

    it('Workspace A cannot retrieve Workspace B task (returns null)', async () => {
      const found = await taskRepository.findById(wsBTask.id, wsA.id);
      expect(found).toBeNull();
    });

    it('Workspace A cannot update Workspace B task (rejected by composite key)', async () => {
      await expect(
        taskRepository.update(wsBTask.id, wsA.id, { title: 'Malicious update attempt' })
      ).rejects.toMatchObject({
        code: 'P2025',
      });
    });

    it('Workspace A cannot delete Workspace B task (rejected by composite key)', async () => {
      await expect(
        taskRepository.delete(wsBTask.id, wsA.id)
      ).rejects.toMatchObject({
        code: 'P2025',
      });
    });

    it('PostgreSQL rejects creating a task referencing a project from another workspace (P2003)', async () => {
      // wsA tries to associate with projB1 (which belongs to wsB)
      await expect(
        taskRepository.create({
          workspaceId: wsA.id,
          projectId: projB1.id,
          creatorId: userA.id,
          title: 'Cross-workspace project pointer',
        })
      ).rejects.toMatchObject({
        code: 'P2003',
      });
    });

    it('PostgreSQL rejects assigning a user who is not a member of the workspace (P2003)', async () => {
      // wsA tries to assign userB (who is only a member of wsB)
      await expect(
        taskRepository.create({
          workspaceId: wsA.id,
          projectId: projA1.id,
          creatorId: userA.id,
          title: 'Cross-workspace user assignee pointer',
          assigneeId: userB.id,
        })
      ).rejects.toMatchObject({
        code: 'P2003',
      });
    });
  });

  describe('6. Subtask Repository Operations & Tenant Boundaries', () => {
    let parentTask;
    let createdSubtask;

    beforeAll(async () => {
      parentTask = await taskRepository.create({
        workspaceId: wsA.id,
        projectId: projA1.id,
        creatorId: userA.id,
        title: 'Task with Subtasks for Repository Tests',
      });
    });

    it('creates a subtask with workspaceId and taskId', async () => {
      createdSubtask = await subtaskRepository.create({
        workspaceId: wsA.id,
        taskId: parentTask.id,
        title: 'First checklist item',
        completed: false,
        order: 0,
      });

      expect(createdSubtask).toBeDefined();
      expect(createdSubtask.id).toBeDefined();
      expect(createdSubtask.workspaceId).toBe(wsA.id);
      expect(createdSubtask.taskId).toBe(parentTask.id);
      expect(createdSubtask.title).toBe('First checklist item');
      expect(createdSubtask.completed).toBe(false);
      expect(createdSubtask.order).toBe(0);
    });

    it('retrieves subtask strictly by id, workspaceId, and taskId', async () => {
      const found = await subtaskRepository.findById(createdSubtask.id, wsA.id, parentTask.id);
      expect(found).not.toBeNull();
      expect(found.id).toBe(createdSubtask.id);
    });

    it('returns null when querying subtask with wrong workspaceId', async () => {
      const found = await subtaskRepository.findById(createdSubtask.id, wsB.id, parentTask.id);
      expect(found).toBeNull();
    });

    it('returns null when querying subtask with wrong taskId', async () => {
      const found = await subtaskRepository.findById(createdSubtask.id, wsA.id, 'fake_task_id');
      expect(found).toBeNull();
    });

    it('toggles subtask completed state', async () => {
      const toggled = await subtaskRepository.toggle(createdSubtask.id, wsA.id, parentTask.id);
      expect(toggled).not.toBeNull();
      expect(toggled.completed).toBe(true);

      const toggledBack = await subtaskRepository.toggle(createdSubtask.id, wsA.id, parentTask.id);
      expect(toggledBack.completed).toBe(false);
    });

    it('subtask toggle supports explicit target completed value and is idempotent on repeat', async () => {
      // Set explicit true
      const setTrue1 = await subtaskRepository.toggle(createdSubtask.id, wsA.id, parentTask.id, true);
      expect(setTrue1.completed).toBe(true);

      // Repeat set explicit true (idempotent, does not flip back)
      const setTrue2 = await subtaskRepository.toggle(createdSubtask.id, wsA.id, parentTask.id, true);
      expect(setTrue2.completed).toBe(true);

      // Set explicit false
      const setFalse1 = await subtaskRepository.toggle(createdSubtask.id, wsA.id, parentTask.id, false);
      expect(setFalse1.completed).toBe(false);

      // Repeat set explicit false (idempotent)
      const setFalse2 = await subtaskRepository.toggle(createdSubtask.id, wsA.id, parentTask.id, false);
      expect(setFalse2.completed).toBe(false);
    });

    it('PostgreSQL rejects direct subtask creation for task in another workspace (P2003)', async () => {
      const otherWsTask = await taskRepository.create({
        workspaceId: wsB.id,
        projectId: projB1.id,
        creatorId: userB.id,
        title: 'Task in WS B for subtask test',
      });

      // wsA tries to create subtask pointing to otherWsTask (which is in wsB)
      await expect(
        subtaskRepository.create({
          workspaceId: wsA.id,
          taskId: otherWsTask.id,
          title: 'Cross-tenant subtask attempt',
        })
      ).rejects.toMatchObject({
        code: 'P2003',
      });
    });

    it('updates subtask details within workspace and task boundary', async () => {
      const updated = await subtaskRepository.update(createdSubtask.id, wsA.id, parentTask.id, {
        title: 'Updated title for subtask',
        order: 2,
      });

      expect(updated.title).toBe('Updated title for subtask');
      expect(updated.order).toBe(2);
    });

    it('refuses update when wrong workspaceId or taskId is provided (returns null)', async () => {
      const wrongWs = await subtaskRepository.update(createdSubtask.id, wsB.id, parentTask.id, {
        title: 'Hacked title',
      });
      expect(wrongWs).toBeNull();

      const wrongTask = await subtaskRepository.update(createdSubtask.id, wsA.id, 'wrong_task', {
        title: 'Hacked title',
      });
      expect(wrongTask).toBeNull();
    });

    it('lists subtasks in deterministic order (order ASC, createdAt ASC)', async () => {
      await subtaskRepository.create({
        workspaceId: wsA.id,
        taskId: parentTask.id,
        title: 'Second item',
        order: 1,
      });

      await subtaskRepository.create({
        workspaceId: wsA.id,
        taskId: parentTask.id,
        title: 'Third item',
        order: 3,
      });

      const list = await subtaskRepository.listByTask(wsA.id, parentTask.id);
      expect(list.length).toBe(3);
      for (let i = 1; i < list.length; i++) {
        expect(list[i].order).toBeGreaterThanOrEqual(list[i - 1].order);
      }
    });

    it('deletes a subtask strictly scoped to workspace and task', async () => {
      const toDelete = await subtaskRepository.create({
        workspaceId: wsA.id,
        taskId: parentTask.id,
        title: 'Item to delete',
      });

      const deleted = await subtaskRepository.delete(toDelete.id, wsA.id, parentTask.id);
      expect(deleted).toBe(true);

      const foundAfter = await subtaskRepository.findById(toDelete.id, wsA.id, parentTask.id);
      expect(foundAfter).toBeNull();
    });

    it('subtask delete returns false for nonexistent subtask or cross-workspace/task mismatch', async () => {
      const notFound = await subtaskRepository.delete('fake_subtask_id', wsA.id, parentTask.id);
      expect(notFound).toBe(false);

      const wrongWs = await subtaskRepository.delete(createdSubtask.id, wsB.id, parentTask.id);
      expect(wrongWs).toBe(false);

      const wrongTask = await subtaskRepository.delete(createdSubtask.id, wsA.id, 'other_task_id');
      expect(wrongTask).toBe(false);
    });
  });

  describe('7. Transaction Client Support & Rollback', () => {
    it('executes repository operations with transaction client successfully', async () => {
      const result = await runInTransaction(async (tx) => {
        const t = await taskRepository.create(
          {
            workspaceId: wsA.id,
            projectId: projA1.id,
            creatorId: userA.id,
            title: 'Transactional Task',
          },
          tx
        );

        const sub = await subtaskRepository.create(
          {
            workspaceId: wsA.id,
            taskId: t.id,
            title: 'Transactional Subtask',
          },
          tx
        );

        return { t, sub };
      });

      expect(result.t.id).toBeDefined();
      expect(result.sub.id).toBeDefined();

      const inDb = await taskRepository.findById(result.t.id, wsA.id);
      expect(inDb).not.toBeNull();
    });

    it('rolls back all repository operations when transaction fails', async () => {
      const taskTitleToRollback = 'Task that should rollback';

      await expect(
        runInTransaction(async (tx) => {
          await taskRepository.create(
            {
              workspaceId: wsA.id,
              projectId: projA1.id,
              creatorId: userA.id,
              title: taskTitleToRollback,
            },
            tx
          );

          // Force failure
          throw new Error('SIMULATED_TRANSACTION_FAILURE');
        })
      ).rejects.toThrow('SIMULATED_TRANSACTION_FAILURE');

      const found = await prisma.task.findFirst({
        where: {
          workspaceId: wsA.id,
          title: taskTitleToRollback,
        },
      });
      expect(found).toBeNull();
    });
  });
});

