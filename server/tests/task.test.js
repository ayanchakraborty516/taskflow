import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/database/prisma.client.js';
import { cleanDatabase } from '../src/database/test-helper.js';

describe('Task Management API End-to-End Integration Tests', () => {
  let ownerToken = null;
  let ownerId = null;

  let memberToken = null;
  let memberId = null;

  let viewerToken = null;
  let viewerId = null;

  let outsiderToken = null;
  let outsiderWorkspaceId = null;

  let workspaceId = null;
  let projectId = null;
  let projectKey = 'TASK';

  let createdTaskId = null;
  let createdSubtaskId = null;

  beforeAll(async () => {
    await cleanDatabase();

    // 1. Create Workspace Owner
    const resOwner = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Task Owner',
        email: 'task.owner@taskflow.dev',
        password: 'Password123!',
        workspaceName: 'Taskflow HQ',
      });
    ownerToken = resOwner.body.token;
    ownerId = resOwner.body.user.id;
    workspaceId = resOwner.body.workspace?.id || resOwner.body.user.currentWorkspaceId;

    // 2. Create Workspace Member
    const resMember = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Task Member',
        email: 'task.member@taskflow.dev',
        password: 'Password123!',
      });
    memberToken = resMember.body.token;
    memberId = resMember.body.user.id;

    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ email: 'task.member@taskflow.dev', role: 'Member' });

    // 3. Create Workspace Viewer
    const resViewer = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Task Viewer',
        email: 'task.viewer@taskflow.dev',
        password: 'Password123!',
      });
    viewerToken = resViewer.body.token;
    viewerId = resViewer.body.user.id;

    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ email: 'task.viewer@taskflow.dev', role: 'Viewer' });

    // 4. Create Outsider in a different workspace
    const resOutsider = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Outsider User',
        email: 'outsider@othercorp.dev',
        password: 'Password123!',
        workspaceName: 'Other Corp',
      });
    outsiderToken = resOutsider.body.token;
    outsiderWorkspaceId = resOutsider.body.workspace?.id || resOutsider.body.user.currentWorkspaceId;

    // 5. Create a test Project inside Taskflow HQ
    const resProj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({
        name: 'Core Application',
        key: projectKey,
        description: 'Building the core SaaS engine',
      });
    projectId = resProj.body.project.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Task Creation & Permissions', () => {
    it('creates a task with auto-generated key, priority, and subtasks', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          projectId,
          title: 'Implement OAuth PKCE flow',
          description: 'Secure authorization code exchange',
          priority: 'high',
          status: 'todo',
          assigneeId: memberId,
          labels: ['Auth', 'Security'],
          subtasks: [
            { title: 'Add code_verifier generator', completed: false },
            { title: 'Store state token securely', completed: true },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.task).toBeDefined();

      const task = res.body.task;
      createdTaskId = task.id;
      expect(task._id).toBe(task.id);
      expect(task.key).toBe(`${projectKey}-1`);
      expect(task.title).toBe('Implement OAuth PKCE flow');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('todo');
      expect(task.assignee.email).toBe('task.member@taskflow.dev');
      expect(task.subtasks.length).toBe(2);
      expect(task.subtasks[0].title).toBe('Add code_verifier generator');
      createdSubtaskId = task.subtasks[0].id;
    });

    it('auto-increments subsequent task key to TASK-2', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          projectId,
          title: 'Setup automated CI/CD pipeline',
          priority: 'medium',
          status: 'todo',
        });

      expect(res.status).toBe(201);
      expect(res.body.task.key).toBe(`${projectKey}-2`);
    });

    it('rejects task creation by Viewers (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          projectId,
          title: 'Viewer unauthorized task',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects task creation without a project (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          title: 'Orphaned Task',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects assigning user who is not a member of the workspace (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          projectId,
          title: 'Cross-tenant assignee task',
          assigneeId: 'non-member-uuid',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Task Listing & Filtering', () => {
    it('lists tasks in workspace', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.tasks)).toBe(true);
      expect(res.body.tasks.length).toBeGreaterThanOrEqual(2);
    });

    it('filters tasks by project', async () => {
      const res = await request(app)
        .get(`/api/tasks?project=${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.tasks.length).toBeGreaterThanOrEqual(2);
      res.body.tasks.forEach((t) => {
        expect(t.projectId).toBe(projectId);
      });
    });

    it('filters tasks by myTasks=true for current user', async () => {
      const res = await request(app)
        .get('/api/tasks?myTasks=true')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.tasks.length).toBeGreaterThanOrEqual(1);
      res.body.tasks.forEach((t) => {
        expect(t.assigneeId).toBe(memberId);
      });
    });

    it('searches tasks across title and description', async () => {
      const res = await request(app)
        .get('/api/tasks?search=OAuth')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.tasks.length).toBe(1);
      expect(res.body.tasks[0].title).toContain('OAuth');
    });
  });

  describe('3. Single Task Details & Tenant Isolation', () => {
    it('retrieves single task details with relations and subtasks', async () => {
      const res = await request(app)
        .get(`/api/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.task.id).toBe(createdTaskId);
      expect(res.body.task.subtasks.length).toBe(2);
      expect(res.body.task.project.key).toBe(projectKey);
    });

    it('outsider in another workspace cannot access task (404 Not Found or 403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .set('x-workspace-id', outsiderWorkspaceId);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('4. Task Update & Subtask Management', () => {
    it('updates task title, priority, and replaces subtasks', async () => {
      const res = await request(app)
        .put(`/api/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          title: 'Implement OAuth PKCE flow (Updated)',
          priority: 'urgent',
          subtasks: [
            { title: 'Replaced subtask 1', completed: false, order: 0 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.task.title).toBe('Implement OAuth PKCE flow (Updated)');
      expect(res.body.task.priority).toBe('urgent');
      expect(res.body.task.subtasks.length).toBe(1);
      expect(res.body.task.subtasks[0].title).toBe('Replaced subtask 1');
      createdSubtaskId = res.body.task.subtasks[0].id;
    });

    it('adds a standalone subtask to the task', async () => {
      const res = await request(app)
        .post(`/api/tasks/${createdTaskId}/subtasks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          title: 'Standalone checklist criterion',
          completed: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.subtask.title).toBe('Standalone checklist criterion');
      expect(res.body.subtasks.length).toBe(2);
    });

    it('toggles a subtask completion status', async () => {
      const res = await request(app)
        .put(`/api/tasks/${createdTaskId}/subtasks/${createdSubtaskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          completed: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.subtask.completed).toBe(true);
      expect(res.body.subtasks.find((s) => s.id === createdSubtaskId).completed).toBe(true);
    });

    it('deletes a subtask', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${createdTaskId}/subtasks/${createdSubtaskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.subtasks.find((s) => s.id === createdSubtaskId)).toBeUndefined();
    });
  });

  describe('5. Kanban Movement & Reordering', () => {
    it('moves a task to in_progress column and shifts contiguous order', async () => {
      const res = await request(app)
        .post(`/api/tasks/${createdTaskId}/move`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          status: 'in_progress',
          newOrder: 0,
        });

      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('in_progress');
      expect(res.body.task.order).toBe(0);
    });

    it('quick shifts a task column without newOrder (appends to end of column)', async () => {
      const res = await request(app)
        .post(`/api/tasks/${createdTaskId}/move`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          status: 'done',
        });

      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('done');
      expect(res.body.task.order).toBeGreaterThanOrEqual(0);
    });

    it('rejects task movement by Viewers (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/tasks/${createdTaskId}/move`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          status: 'todo',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('6. Task Deletion', () => {
    it('deletes a task successfully', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify task no longer exists
      const checkRes = await request(app)
        .get(`/api/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(checkRes.status).toBe(404);
    });

    it('rejects task deletion by Viewers (403 Forbidden)', async () => {
      // Create a temporary task
      const tempTask = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          projectId,
          title: 'Task to test viewer deletion rejection',
        });

      const res = await request(app)
        .delete(`/api/tasks/${tempTask.body.task.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(403);
    });
  });
});
