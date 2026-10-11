const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('Projects and Tasks Lifecycle API', () => {
  let token = '';
  let workspaceId = '';
  let projectId = '';
  let taskId = '';
  let subtaskId = '';

  beforeAll(async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Carlos Engineer',
        email: 'carlos@example.com',
        password: 'Password123!',
        workspaceName: 'Carlos Labs',
      });
    token = regRes.body.token;
    workspaceId = regRes.body.user.currentWorkspace;
  });

  it('should create a project with custom key and category', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        name: 'Payment Processing Service',
        key: 'PAY',
        category: 'Engineering',
        description: 'Microservice for payment processing',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.project.name).toBe('Payment Processing Service');
    expect(res.body.project.key).toBe('PAY');

    projectId = res.body.project._id;
  });

  it('should list projects and return stats', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.projects.length).toBeGreaterThanOrEqual(1);
    expect(res.body.projects[0]).toHaveProperty('stats');
  });

  it('should create a task with subtasks and priority', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        title: 'Integrate Stripe Webhooks',
        description: 'Handle charge.succeeded and invoice.payment_failed',
        project: projectId,
        status: 'todo',
        priority: 'high',
        labels: ['Stripe', 'Billing'],
        subtasks: [
          { title: 'Create signature verification middleware', completed: false },
          { title: 'Test idempotency keys', completed: false },
        ],
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.task.title).toBe('Integrate Stripe Webhooks');
    expect(res.body.task.key).toBe('PAY-101');
    expect(res.body.task.subtasks.length).toBe(2);

    taskId = res.body.task._id;
    subtaskId = res.body.task.subtasks[0]._id;
  });

  it('should update task details and status', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        status: 'in_progress',
        priority: 'urgent',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.task.status).toBe('in_progress');
    expect(res.body.task.priority).toBe('urgent');
  });

  it('should move task to Done column with /api/tasks/:id/move', async () => {
    const res = await request(app)
      .post(`/api/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        status: 'done',
        newOrder: 0,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.task.status).toBe('done');
  });

  it('should toggle a subtask completion status', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}/subtasks/${subtaskId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const toggled = res.body.subtasks.find((s) => s._id === subtaskId);
    expect(toggled.completed).toBe(true);
  });

  it('should reject project creation if lead is not a member of the workspace', async () => {
    const fakeUserId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        name: 'Invalid Lead Project',
        lead: fakeUserId,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/member of this workspace/i);
  });

  it('should reject task creation if assignee is not a member of the workspace', async () => {
    const fakeUserId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        title: 'Task with Fake Assignee',
        project: projectId,
        assignee: fakeUserId,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/member of this workspace/i);
  });

  it('should reject task creation with invalid status or priority', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        title: 'Task with Bad Status',
        project: projectId,
        status: 'invalid_status_xyz',
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should archive and unarchive a project', async () => {
    const resArchive = await request(app)
      .put(`/api/projects/${projectId}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId);

    expect(resArchive.statusCode).toBe(200);
    expect(resArchive.body.success).toBe(true);
    expect(resArchive.body.project.status).toBe('archived');

    // Unarchive back to in_progress
    const resUnarchive = await request(app)
      .put(`/api/projects/${projectId}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId);

    expect(resUnarchive.statusCode).toBe(200);
    expect(resUnarchive.body.success).toBe(true);
    expect(resUnarchive.body.project.status).toBe('in_progress');
  });

  it('should batch reorder tasks with /api/tasks/reorder', async () => {
    const res = await request(app)
      .post('/api/tasks/reorder')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .send({
        tasks: [
          { id: taskId, status: 'in_review', order: 1 },
        ],
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should log activities for task and project changes', async () => {
    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.activities.length).toBeGreaterThanOrEqual(1);
  });

  it('should delete a task', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it is gone
    const getRes = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId);

    expect(getRes.statusCode).toBe(404);
  });

  it('should delete a project and its cascade data', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify project is gone
    const getRes = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId);

    expect(getRes.statusCode).toBe(404);
  });
});
