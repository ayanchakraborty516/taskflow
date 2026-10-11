const request = require('supertest');
const app = require('../src/app');
const Task = require('../src/models/Task');
const Comment = require('../src/models/Comment');
const Notification = require('../src/models/Notification');
const Workspace = require('../src/models/Workspace');
require('./setup');

describe('Phase 3: Dashboard Aggregation, Comments, Notifications, and Permissions', () => {
  let ownerToken = '';
  let memberToken = '';
  let otherToken = '';
  let workspaceId = '';
  let otherWorkspaceId = '';
  let ownerId = '';
  let memberId = '';
  let projectId = '';
  let taskId = '';
  let commentId = '';
  let notificationId = '';

  beforeAll(async () => {
    // 1. Register Owner
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Owner',
        email: 'alice.owner@phase3.com',
        password: 'Password123!',
        workspaceName: 'Phase3 Team Workspace',
      });
    ownerToken = ownerRes.body.token;
    ownerId = ownerRes.body.user._id;
    workspaceId = ownerRes.body.user.currentWorkspace;

    // 2. Register Member and add to workspace
    const memberRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Developer',
        email: 'bob.dev@phase3.com',
        password: 'Password123!',
        workspaceName: 'Bob Personal',
      });
    memberToken = memberRes.body.token;
    memberId = memberRes.body.user._id;

    // Add Bob to Alice's workspace as 'Member'
    await Workspace.findByIdAndUpdate(workspaceId, {
      $push: { members: { user: memberId, role: 'Member' } },
    });

    // 3. Register Other user in separate workspace
    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Eve Intruder',
        email: 'eve.intruder@phase3.com',
        password: 'Password123!',
        workspaceName: 'Eve Secure HQ',
      });
    otherToken = otherRes.body.token;
    otherWorkspaceId = otherRes.body.user.currentWorkspace;

    // Create a project in Alice's workspace
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', workspaceId)
      .send({
        name: 'Alpha Sprint Platform',
        key: 'ASP',
        category: 'Engineering',
        description: 'Core platform sprint project',
      });
    projectId = projRes.body.project._id;
  });

  describe('Task Assignment and Notification Generation', () => {
    it('should generate a task_assigned notification when a task is assigned to a member', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          title: 'Implement OAuth Token Refresh',
          project: projectId,
          status: 'in_progress',
          priority: 'high',
          assignee: memberId,
          dueDate: tomorrow.toISOString(),
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      taskId = res.body.task._id;

      // Verify that Bob received an in-app notification
      const notifRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(notifRes.statusCode).toBe(200);
      expect(notifRes.body.unreadCount).toBeGreaterThanOrEqual(1);

      const assignedNotif = notifRes.body.notifications.find((n) => n.type === 'task_assigned');
      expect(assignedNotif).toBeDefined();
      expect(assignedNotif.recipient.toString()).toBe(memberId.toString());
      expect(assignedNotif.title).toContain('New Task Assigned');
      notificationId = assignedNotif._id;
    });

    it('should create a notification for assignee when task status is updated', async () => {
      const moveRes = await request(app)
        .post(`/api/tasks/${taskId}/move`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ status: 'done', order: 0 });

      expect(moveRes.statusCode).toBe(200);

      // Verify notification for Bob
      const notifRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      const statusNotif = notifRes.body.notifications.find((n) => n.type === 'task_status');
      expect(statusNotif).toBeDefined();
      expect(statusNotif.message).toContain('done');
    });
  });

  describe('Notification Management and Scoping', () => {
    it('should allow recipient to mark notification as read and decrement unread count', async () => {
      const readRes = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(readRes.statusCode).toBe(200);
      expect(readRes.body.notification.read).toBe(true);

      const notifListRes = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(notifListRes.statusCode).toBe(200);
      expect(notifListRes.body.notifications.some((n) => n._id.toString() === notificationId.toString())).toBe(false);
    });

    it('should allow recipient to mark all notifications as read', async () => {
      const readAllRes = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(readAllRes.statusCode).toBe(200);

      const verifyRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(verifyRes.body.unreadCount).toBe(0);
    });

    it('should prevent another user from marking or deleting a notification they do not own', async () => {
      const unauthorizedRes = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .set('x-workspace-id', otherWorkspaceId);

      expect(unauthorizedRes.statusCode).toBe(404);
    });
  });

  describe('Comments Permissions and Task Enforceability', () => {
    it('should allow a team member to add a comment to a workspace task', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          task: taskId,
          content: 'I have validated the token refresh with integration tests.',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.comment.content).toBe('I have validated the token refresh with integration tests.');
      expect(res.body.comment.author.name).toBe('Bob Developer');
      expect(res.body.comment).toHaveProperty('createdAt');
      commentId = res.body.comment._id;

      // Alice (creator of task) should receive a notification
      const aliceNotifs = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      const commentNotif = aliceNotifs.body.notifications.find((n) => n.type === 'comment_added');
      expect(commentNotif).toBeDefined();
      expect(commentNotif.message).toContain('Bob Developer');
    });

    it('should list comments for a task in chronological order', async () => {
      const res = await request(app)
        .get(`/api/comments/task/${taskId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.comments.length).toBeGreaterThanOrEqual(1);
      expect(res.body.comments[0]._id.toString()).toBe(commentId.toString());
    });

    it('should prevent an outside user from reading comments on a task outside their workspace', async () => {
      const res = await request(app)
        .get(`/api/comments/task/${taskId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .set('x-workspace-id', otherWorkspaceId);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('not found in this workspace');
    });

    it('should prevent an outside user from adding comments to a task outside their workspace', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${otherToken}`)
        .set('x-workspace-id', otherWorkspaceId)
        .send({
          task: taskId,
          content: 'Malicious attempt to comment across workspaces.',
        });

      expect(res.statusCode).toBe(404);
    });

    it('should allow author to delete their own comment', async () => {
      // Create a temporary comment by Bob
      const addRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          task: taskId,
          content: 'Temporary remark to delete.',
        });

      const tempCommentId = addRes.body.comment._id;

      const delRes = await request(app)
        .delete(`/api/comments/${tempCommentId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(delRes.statusCode).toBe(200);
      expect(delRes.body.success).toBe(true);
    });

    it('should allow Owner or Admin to delete comments made by other members', async () => {
      // Bob comments
      const addRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          task: taskId,
          content: 'Comment that will be moderated by workspace owner.',
        });

      const moderatedCommentId = addRes.body.comment._id;

      // Alice (Owner) deletes it
      const delRes = await request(app)
        .delete(`/api/comments/${moderatedCommentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(delRes.statusCode).toBe(200);
      expect(delRes.body.success).toBe(true);
    });
  });

  describe('Dashboard Metrics Aggregation', () => {
    it('should calculate active projects, assigned tasks, completed tasks, upcoming deadlines, and 7-day velocity chart', async () => {
      // Create additional tasks for accurate metric validation
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          title: 'Upcoming Security Review',
          project: projectId,
          status: 'todo',
          priority: 'urgent',
          assignee: memberId,
          dueDate: threeDaysLater.toISOString(),
        });

      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const { summary, upcomingDeadlines, completionChart, recentActivity, activeProjects } = res.body;

      // Check summary counts
      expect(summary.activeProjectsCount).toBeGreaterThanOrEqual(1);
      expect(summary.statusCounts).toBeDefined();
      expect(summary.statusCounts).toHaveProperty('todo');
      expect(summary.statusCounts).toHaveProperty('done');
      expect(summary.completedTasksCount).toBeGreaterThanOrEqual(1);

      // Check upcoming deadlines
      expect(Array.isArray(upcomingDeadlines)).toBe(true);
      expect(upcomingDeadlines.length).toBeGreaterThanOrEqual(1);
      expect(upcomingDeadlines[0]).toHaveProperty('dueDate');
      expect(upcomingDeadlines[0]).toHaveProperty('project');

      // Check completion velocity chart (7 days)
      expect(Array.isArray(completionChart)).toBe(true);
      expect(completionChart.length).toBe(7);
      expect(completionChart[6]).toHaveProperty('day');
      expect(completionChart[6]).toHaveProperty('completed');

      // Check recent activity & active projects
      expect(Array.isArray(recentActivity)).toBe(true);
      expect(Array.isArray(activeProjects)).toBe(true);
      expect(activeProjects[0]).toHaveProperty('progress');
    });
  });
});
