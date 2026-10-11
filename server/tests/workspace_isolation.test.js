const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('Workspace Isolation & Cross-Tenant Security', () => {
  let userAToken = '';
  let userAWorkspaceId = '';
  let projectAId = '';
  let taskAId = '';

  let userBToken = '';
  let userBWorkspaceId = '';

  beforeAll(async () => {
    // 1. Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User Alpha',
        email: 'alpha@org.com',
        password: 'Password123!',
        workspaceName: 'Alpha Workspace',
      });
    userAToken = resA.body.token;
    userAWorkspaceId = resA.body.user.currentWorkspace;

    // Create a project and task in Workspace Alpha
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-workspace-id', userAWorkspaceId)
      .send({
        name: 'Secret Project Alpha',
        key: 'ALPHA',
        description: 'Highly confidential project',
      });
    projectAId = projRes.body.project._id;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-workspace-id', userAWorkspaceId)
      .send({
        title: 'Confidential Strategy Task',
        project: projectAId,
        status: 'todo',
        priority: 'urgent',
      });
    taskAId = taskRes.body.task._id;

    // 2. Register User B (completely different workspace)
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User Beta',
        email: 'beta@org.com',
        password: 'Password123!',
        workspaceName: 'Beta Workspace',
      });
    userBToken = resB.body.token;
    userBWorkspaceId = resB.body.user.currentWorkspace;
  });

  it('should deny User B from listing projects in Workspace A', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', userAWorkspaceId); // Tampered header

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should deny User B from fetching User A project by ID', async () => {
    // User B tries with their own workspace context
    const res = await request(app)
      .get(`/api/projects/${projectAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', userBWorkspaceId);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should deny User B from fetching User A task by ID', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', userBWorkspaceId);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should deny User B from updating or moving User A task', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', userBWorkspaceId)
      .send({
        title: 'Hacked Task Title',
        status: 'done',
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should deny User B from deleting User A project', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectAId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .set('x-workspace-id', userBWorkspaceId);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
