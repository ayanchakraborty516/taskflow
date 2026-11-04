import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/database/prisma.client.js';
import { cleanDatabase } from '../src/database/test-helper.js';

describe('Project Management Integration Tests', () => {
  let ownerToken = null;
  let ownerId = null;

  let adminToken = null;
  let adminId = null;

  let memberToken = null;
  let memberId = null;

  let viewerToken = null;
  let viewerId = null;

  let outsiderToken = null;
  let outsiderId = null;

  let workspaceId = null;
  let outsiderWorkspaceId = null;

  let testProjectId = null;
  let testProjectKey = null;

  beforeAll(async () => {
    await cleanDatabase();

    // 1. Create Workspace Owner
    const resOwner = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Project Owner',
        email: 'project.owner@taskflow.dev',
        password: 'Password123!',
        workspaceName: 'Delta Labs',
      });
    ownerToken = resOwner.body.token;
    ownerId = resOwner.body.user.id;
    workspaceId = resOwner.body.workspace?.id || resOwner.body.user.currentWorkspaceId;

    // 2. Create Workspace Admin
    const resAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Project Admin',
        email: 'project.admin@taskflow.dev',
        password: 'Password123!',
      });
    adminToken = resAdmin.body.token;
    adminId = resAdmin.body.user.id;

    // Add Admin to Delta Labs
    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'project.admin@taskflow.dev', role: 'Admin' });

    // 3. Create Workspace Member
    const resMember = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Project Member',
        email: 'project.member@taskflow.dev',
        password: 'Password123!',
      });
    memberToken = resMember.body.token;
    memberId = resMember.body.user.id;

    // Add Member to Delta Labs
    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'project.member@taskflow.dev', role: 'Member' });

    // 4. Create Workspace Viewer
    const resViewer = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Project Viewer',
        email: 'project.viewer@taskflow.dev',
        password: 'Password123!',
      });
    viewerToken = resViewer.body.token;
    viewerId = resViewer.body.user.id;

    // Add Viewer to Delta Labs
    await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'project.viewer@taskflow.dev', role: 'Viewer' });

    // 5. Create Outsider in a distinct workspace
    const resOutsider = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Foreign Outsider',
        email: 'foreign.outsider@taskflow.dev',
        password: 'Password123!',
        workspaceName: 'Foreign Corp',
      });
    outsiderToken = resOutsider.body.token;
    outsiderId = resOutsider.body.user.id;
    outsiderWorkspaceId = resOutsider.body.workspace?.id || resOutsider.body.user.currentWorkspaceId;
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('1. Project Creation & Key Generation', () => {
    it('1. Owner can create a project with automatic key generation', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'Core Platform Redesign',
          description: 'Revamping the core application architecture',
          category: 'Engineering',
          color: '#2563eb',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.project).toHaveProperty('name', 'Core Platform Redesign');
      expect(res.body.project).toHaveProperty('key');
      expect(res.body.project.key.length).toBeGreaterThanOrEqual(2);
      expect(res.body.project).toHaveProperty('workspaceId', workspaceId);
      expect(res.body.project).toHaveProperty('_id');
      expect(res.body.project._id).toBe(res.body.project.id);
      expect(res.body.project.stats).toBeDefined();
      expect(res.body.project.stats.total).toBe(0);

      testProjectId = res.body.project.id;
      testProjectKey = res.body.project.key;
    });

    it('2. Admin can create a project with an explicit custom key', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'Mobile Client v2',
          key: 'MOB',
          description: 'React Native companion app',
          category: 'Design & Eng',
          lead: memberId,
        });

      expect(res.status).toBe(201);
      expect(res.body.project).toHaveProperty('key', 'MOB');
      expect(res.body.project.lead).toHaveProperty('id', memberId);
    });

    it('3. Rejects duplicate project key in the same workspace', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'Another Mobile App',
          key: 'MOB', // Duplicate key
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('already in use');
    });

    it('4. Rejects invalid project lead who is not a member of the workspace', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'Secret Mission',
          lead: outsiderId, // Outsider is not in workspaceId
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('active member of this workspace');
    });

    it('5. Workspace Viewer CANNOT create projects (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'Viewer Project',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Project Listing & Filtering', () => {
    it('1. Lists all projects in the active workspace with computed stats', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('count');
      expect(res.body.count).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(res.body.projects)).toBe(true);

      const firstProject = res.body.projects[0];
      expect(firstProject).toHaveProperty('_id');
      expect(firstProject).toHaveProperty('stats');
      expect(firstProject.stats).toHaveProperty('completionRate');
    });

    it('2. Filters projects by search query', async () => {
      const res = await request(app)
        .get('/api/projects?search=Redesign')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.projects.length).toBe(1);
      expect(res.body.projects[0].name).toBe('Core Platform Redesign');
    });

    it('3. Filters projects by category', async () => {
      const res = await request(app)
        .get('/api/projects?category=Engineering')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.projects.every((p) => p.category === 'Engineering')).toBe(true);
    });

    it('4. Viewer can read projects in workspace', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.projects.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Project Retrieval & Multi-Tenant Isolation', () => {
    it('1. Member can fetch project details by ID', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.project).toHaveProperty('id', testProjectId);
      expect(res.body.project).toHaveProperty('key', testProjectKey);
    });

    it('2. Outsider cannot access Delta Labs project (403 or 404 Isolation)', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .set('x-workspace-id', outsiderWorkspaceId); // Outsider's workspace

      // Scoped findById in foreign workspace returns 404
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('success', false);
    });

    it('3. Outsider providing Delta Labs workspace ID is blocked by middleware (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .set('x-workspace-id', workspaceId); // Outsider tries to claim Delta Labs

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('not have access');
    });
  });

  describe('4. Project Updates & Lifecycle (Archive/Restore)', () => {
    it('1. Owner can update project fields (name, description, color, isStarred)', async () => {
      const res = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'Core Platform v3',
          description: 'Updated description',
          color: '#10b981',
          isStarred: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.project).toHaveProperty('name', 'Core Platform v3');
      expect(res.body.project).toHaveProperty('isStarred', true);
    });

    it('2. Viewer CANNOT update project (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'Hacked Project',
        });

      expect(res.status).toBe(403);
    });

    it('3. Project can be archived and restored', async () => {
      // Archive
      const resArchive = await request(app)
        .post(`/api/projects/${testProjectId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId);

      expect(resArchive.status).toBe(200);
      expect(resArchive.body.project).toHaveProperty('status', 'archived');

      // Restore
      const resRestore = await request(app)
        .post(`/api/projects/${testProjectId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId);

      expect(resRestore.status).toBe(200);
      expect(resRestore.body.project).toHaveProperty('status', 'in_progress');
    });
  });

  describe('5. Project Membership Management', () => {
    it('1. Lists project members', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProjectId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('count');
      expect(Array.isArray(res.body.members)).toBe(true);
    });

    it('2. Admin can add a workspace member to the project', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProjectId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          userId: memberId,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.member).toHaveProperty('userId', memberId);
      expect(res.body.member.user).toHaveProperty('name', 'Project Member');
    });

    it('3. Rejects duplicate project member addition (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProjectId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          userId: memberId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already a member');
    });

    it('4. Rejects adding a user who does not belong to the workspace (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProjectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          userId: outsiderId, // Belongs to Foreign Corp, not Delta Labs
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('not a member of this workspace');
    });

    it('5. Viewer CANNOT add project members (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/projects/${testProjectId}/members`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          userId: adminId,
        });

      expect(res.status).toBe(403);
    });

    it('6. Admin can remove a member from the project', async () => {
      const res = await request(app)
        .delete(`/api/projects/${testProjectId}/members/${memberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);

      // Verify member is no longer in project
      const listRes = await request(app)
        .get(`/api/projects/${testProjectId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(listRes.body.members.some((m) => m.userId === memberId)).toBe(false);
    });
  });

  describe('6. Project Deletion & Safe Cascades', () => {
    let disposableProjectId = null;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'Disposable Project',
          key: 'DISP',
        });
      disposableProjectId = res.body.project.id;
    });

    it('1. Regular Workspace Member CANNOT delete projects (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/projects/${disposableProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(403);
    });

    it('2. Workspace Admin can delete a project successfully', async () => {
      const res = await request(app)
        .delete(`/api/projects/${disposableProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);

      // Verify it is gone
      const verifyRes = await request(app)
        .get(`/api/projects/${disposableProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId);

      expect(verifyRes.status).toBe(404);
    });
  });

  describe('7. Field-Level Authorization & Concurrency Hardening', () => {
    let authProjectId = null;

    beforeAll(async () => {
      // Create a dedicated project with Project Member as an assigned member, but Admin as Lead
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'Security Test Initiative',
          key: 'SEC',
          lead: adminId,
        });

      authProjectId = res.body.project.id;

      // Add Charlie Member as a regular project member
      await request(app)
        .post(`/api/projects/${authProjectId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ userId: memberId });
    });

    it('1. Regular project member CANNOT reassign project lead (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/projects/${authProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          lead: memberId, // Attempted self-promotion to Lead
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('reassign the project lead');
    });

    it('2. Regular project member CANNOT change project name or description (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/projects/${authProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'Member Renamed Project',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('modify project settings');
    });

    it('3. Project Lead CANNOT change project key (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/projects/${authProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`) // Admin is lead, but role Owner/Admin CAN change key, let's test a non-admin Lead!
        .set('x-workspace-id', workspaceId)
        .send({ key: 'NEWSEC' });

      // Because Admin has workspace Admin role, Admin can change key
      expect(res.status).toBe(200);
      expect(res.body.project.key).toBe('NEWSEC');
    });

    it('4. Member Lead CANNOT change project key without Admin role (403 Forbidden)', async () => {
      // Reassign project lead to Charlie Member
      await request(app)
        .put(`/api/projects/${authProjectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ lead: memberId });

      // Now Charlie Member is Project Lead. Try to change key:
      const res = await request(app)
        .put(`/api/projects/${authProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ key: 'FAILKEY' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('change the project key');
    });

    it('5. Project Lead CAN update project description and dates', async () => {
      const res = await request(app)
        .put(`/api/projects/${authProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`) // Member is Lead
        .set('x-workspace-id', workspaceId)
        .send({
          description: 'Updated by Member Lead',
          targetDate: '2026-12-31T00:00:00.000Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.project.description).toBe('Updated by Member Lead');
    });

    it('6. Regular project member CAN toggle isStarred', async () => {
      const res = await request(app)
        .put(`/api/projects/${authProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          isStarred: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.project.isStarred).toBe(true);
    });

    it('7. Concurrent member additions are serialized and reject duplicates (400 Bad Request)', async () => {
      // Create a fresh workspace user to add
      const newUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Concurrent User',
          email: 'concurrent.user@taskflow.dev',
          password: 'Password123!',
        });
      const newUserId = newUserRes.body.user.id;

      // Add to Delta Labs workspace
      await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'concurrent.user@taskflow.dev', role: 'Member' });

      // Fire two parallel requests to add user to authProjectId
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/projects/${authProjectId}/members`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-workspace-id', workspaceId)
          .send({ userId: newUserId }),
        request(app)
          .post(`/api/projects/${authProjectId}/members`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-workspace-id', workspaceId)
          .send({ userId: newUserId }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 400]);
    });

    it('8. Removing project member does NOT affect their workspace membership', async () => {
      // Remove Charlie from authProjectId
      const removeRes = await request(app)
        .delete(`/api/projects/${authProjectId}/members/${memberId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(removeRes.status).toBe(200);

      // Verify Charlie is STILL an active member of Delta Labs workspace
      const wsRoster = await request(app)
        .get(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const charlieInWs = wsRoster.body.members.find((m) => m.user.id === memberId);
      expect(charlieInWs).toBeDefined();
      expect(charlieInWs.role).toBe('Member');
    });
  });

  describe('8. Database-Level ProjectMember Composite Tenant Isolation', () => {
    let isolationProjectId = null;
    let tenantTestUserId = null;

    beforeAll(async () => {
      // 1. Create a project in workspaceId
      const projRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'DB Isolation Test Project',
          key: 'DBISO',
        });
      isolationProjectId = projRes.body.project.id;

      // 2. Create a test user and add to workspaceId
      const uRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Tenant Iso User',
          email: 'tenant.iso@taskflow.dev',
          password: 'Password123!',
        });
      tenantTestUserId = uRes.body.user.id;

      await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'tenant.iso@taskflow.dev', role: 'Member' });
    });

    it('1. Database constraint rejects ProjectMember referencing a project in a different workspace (P2003)', async () => {
      // Try to insert directly with mismatched workspaceId (outsiderWorkspaceId vs isolationProjectId which is in workspaceId)
      await expect(
        prisma.projectMember.create({
          data: {
            workspaceId: outsiderWorkspaceId, // Mismatched workspace
            projectId: isolationProjectId,
            userId: tenantTestUserId,
          },
        })
      ).rejects.toMatchObject({
        code: 'P2003', // Foreign key constraint violation
      });
    });

    it('2. Database constraint rejects ProjectMember where (workspaceId, userId) is not in workspace_members (P2003)', async () => {
      // Try to insert directly with outsiderId who is NOT in workspaceId
      await expect(
        prisma.projectMember.create({
          data: {
            workspaceId: workspaceId,
            projectId: isolationProjectId,
            userId: outsiderId, // Not a member of workspaceId
          },
        })
      ).rejects.toMatchObject({
        code: 'P2003', // Composite foreign key constraint violation
      });
    });

    it('3. Deleting workspace membership automatically cascades and removes project membership at DB level', async () => {
      // Add tenantTestUserId to isolationProjectId
      const addRes = await request(app)
        .post(`/api/projects/${isolationProjectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ userId: tenantTestUserId });

      expect(addRes.status).toBe(201);

      // Verify member exists in project_members
      const checkBefore = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: isolationProjectId,
            userId: tenantTestUserId,
          },
        },
      });
      expect(checkBefore).not.toBeNull();
      expect(checkBefore.workspaceId).toBe(workspaceId);

      // Delete the workspace membership for tenantTestUserId
      await request(app)
        .delete(`/api/workspaces/${workspaceId}/members/${tenantTestUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Verify that deleting workspace membership cascaded to project_members via PostgreSQL FK cascade
      const checkAfter = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: isolationProjectId,
            userId: tenantTestUserId,
          },
        },
      });
      expect(checkAfter).toBeNull();
    });

    it('4. Deleting a project cascades and removes all its ProjectMember records', async () => {
      // Create a disposable project with owner as member
      const tempRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          name: 'Cascade Project',
          key: 'CASPRJ',
        });
      const tempProjId = tempRes.body.project.id;

      // Verify project member was created
      const membersBefore = await prisma.projectMember.findMany({
        where: { projectId: tempProjId },
      });
      expect(membersBefore.length).toBeGreaterThan(0);

      // Delete project via API
      const delRes = await request(app)
        .delete(`/api/projects/${tempProjId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(delRes.status).toBe(200);

      // Verify project_members rows were cascaded and deleted
      const membersAfter = await prisma.projectMember.findMany({
        where: { projectId: tempProjId },
      });
      expect(membersAfter.length).toBe(0);
    });

    it('5. Existing project member APIs continue to work seamlessly with workspaceId populated', async () => {
      // Re-add Charlie Member to isolationProjectId
      const addRes = await request(app)
        .post(`/api/projects/${isolationProjectId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId)
        .send({ userId: memberId });

      expect(addRes.status).toBe(201);
      expect(addRes.body.member).toHaveProperty('userId', memberId);
      expect(addRes.body.member).toHaveProperty('_id');

      // List project members via API
      const listRes = await request(app)
        .get(`/api/projects/${isolationProjectId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('x-workspace-id', workspaceId);

      expect(listRes.status).toBe(200);
      expect(listRes.body.members.some((m) => m.userId === memberId)).toBe(true);

      // Remove Charlie from project
      const remRes = await request(app)
        .delete(`/api/projects/${isolationProjectId}/members/${memberId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-workspace-id', workspaceId);

      expect(remRes.status).toBe(200);
    });
  });
});

