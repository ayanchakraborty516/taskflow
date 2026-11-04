import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/database/prisma.client.js';
import { cleanDatabase } from '../src/database/test-helper.js';

describe('Collaboration & Analytics API End-to-End Tests', () => {
  let ownerToken = null;
  let ownerId = null;

  let memberToken = null;
  let memberId = null;

  let viewerToken = null;
  let viewerId = null;

  let workspaceId = null;
  let projectId = null;
  let taskId = null;
  let createdCommentId = null;
  let notificationId = null;

  beforeAll(async () => {
    await cleanDatabase();

    // 1. Register Owner & create workspace
    const resOwner = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Collab Owner',
        email: 'collab.owner@taskflow.dev',
        password: 'Password123!',
        workspaceName: 'Collab Workspace',
      });

    ownerToken = resOwner.body.token;
    ownerId = resOwner.body.user.id;
    workspaceId = resOwner.body.workspace?.id || resOwner.body.user.currentWorkspaceId;

    // 2. Register Member and add to workspace
    const resMember = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Collab Member',
        email: 'collab.member@taskflow.dev',
        password: 'Password123!',
      });
    memberToken = resMember.body.token;
    memberId = resMember.body.user.id;

    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ email: 'collab.member@taskflow.dev', role: 'Member' });

    // 3. Register Viewer and add to workspace
    const resViewer = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Collab Viewer',
        email: 'collab.viewer@taskflow.dev',
        password: 'Password123!',
      });
    viewerToken = resViewer.body.token;
    viewerId = resViewer.body.user.id;

    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({ email: 'collab.viewer@taskflow.dev', role: 'Viewer' });

    // 4. Create Project
    const resProj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({
        name: 'Analytics Engine',
        key: 'ANL',
        category: 'Backend',
      });
    projectId = resProj.body.data?.id || resProj.body.project?.id || resProj.body.id;

    // 5. Create Task assigned to Member
    const resTask = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({
        projectId,
        title: 'Build Notification Pipeline',
        priority: 'high',
        assigneeId: memberId,
        dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      });
    taskId = resTask.body.task?.id || resTask.body.data?.id || resTask.body.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  describe('Comments API', () => {
    it('allows owner to add a comment to a task', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          taskId,
          content: 'Please ensure high performance indexing.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.comment).toBeDefined();
      expect(res.body.comment.content).toBe('Please ensure high performance indexing.');
      expect(res.body.comment._id).toBeDefined();
      expect(res.body.comment.author.name).toBe('Collab Owner');

      createdCommentId = res.body.comment.id;
    });

    it('allows member to view task comments', async () => {
      const res = await request(app)
        .get(`/api/comments/task/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.comments)).toBe(true);
      expect(res.body.comments.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects comment creation from Viewer with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          taskId,
          content: 'Viewers should not be able to comment.',
        });

      expect(res.status).toBe(403);
    });

    it('rejects empty comment content with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          taskId,
          content: '   ',
        });

      expect(res.status).toBe(400);
    });

    it('prevents non-author member from deleting owner comment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${createdCommentId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(403);
    });

    it('allows owner to delete comment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${createdCommentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Notifications API', () => {
    it('delivers notification to assignee when assigned or commented', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.notifications)).toBe(true);
      expect(res.body.notifications.length).toBeGreaterThanOrEqual(1);

      notificationId = res.body.notifications[0].id;
      expect(res.body.notifications[0]._id).toBeDefined();
    });

    it('marks a single notification as read', async () => {
      const res = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('marks all notifications as read', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('deletes a notification', async () => {
      const res = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Activities API', () => {
    it('retrieves workspace activity logs', async () => {
      const res = await request(app)
        .get('/api/activities')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const firstActivity = res.body.data[0];
      expect(firstActivity._id).toBeDefined();
      expect(firstActivity.details).toBeDefined();
      expect(firstActivity.user).toBeDefined();
    });
  });

  describe('Dashboard API', () => {
    it('returns complete dashboard metrics matching frontend contract', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify summary object and all required fields
      expect(res.body.summary).toBeDefined();
      expect(typeof res.body.summary.activeProjectsCount).toBe('number');
      expect(typeof res.body.summary.myTasksCount).toBe('number');
      expect(typeof res.body.summary.totalTasksCount).toBe('number');
      expect(typeof res.body.summary.completedTasksCount).toBe('number');
      expect(typeof res.body.summary.velocityRate).toBe('number');

      expect(res.body.summary.statusCounts).toBeDefined();
      expect(typeof res.body.summary.statusCounts.todo).toBe('number');
      expect(typeof res.body.summary.statusCounts.in_progress).toBe('number');
      expect(typeof res.body.summary.statusCounts.in_review).toBe('number');
      expect(typeof res.body.summary.statusCounts.done).toBe('number');

      // Verify lists and collections
      expect(Array.isArray(res.body.priorityTasks)).toBe(true);
      expect(Array.isArray(res.body.upcomingDeadlines)).toBe(true);
      expect(Array.isArray(res.body.completionChart)).toBe(true);
      expect(res.body.completionChart.length).toBe(7);
      expect(Array.isArray(res.body.recentActivity)).toBe(true);
      expect(Array.isArray(res.body.activeProjects)).toBe(true);

      if (res.body.activeProjects.length > 0) {
        const project = res.body.activeProjects[0];
        expect(project._id).toBeDefined();
        expect(typeof project.progress).toBe('number');
        expect(typeof project.taskCount).toBe('number');
      }
    });
  });
});
