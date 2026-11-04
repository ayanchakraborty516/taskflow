import request from 'supertest';
import app from '../src/app.js';
import { cleanDatabase } from '../src/database/test-helper.js';

describe('Workspace and Membership Management Integration Tests', () => {
  let userOwnerToken = null;
  let userOwnerId = null;

  let userAdminToken = null;
  let userAdminId = null;

  let userMemberToken = null;
  let userMemberId = null;

  let userOutsiderToken = null;
  let userOutsiderId = null;

  let primaryWorkspaceId = null;
  let primaryInviteCode = null;
  let secondaryWorkspaceId = null;

  beforeAll(async () => {
    await cleanDatabase();

    // 1. Create Primary Owner
    const resOwner = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Owner',
        email: 'alice.owner@taskflow.dev',
        password: 'Password123!',
        workspaceName: 'Alpha Corp',
      });
    userOwnerToken = resOwner.body.token;
    userOwnerId = resOwner.body.user.id;
    primaryWorkspaceId = resOwner.body.workspace?.id || resOwner.body.user.currentWorkspaceId;

    // 2. Create User to become Admin
    const resAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Admin',
        email: 'bob.admin@taskflow.dev',
        password: 'Password123!',
      });
    userAdminToken = resAdmin.body.token;
    userAdminId = resAdmin.body.user.id;

    // 3. Create User to become Regular Member
    const resMember = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Charlie Member',
        email: 'charlie.member@taskflow.dev',
        password: 'Password123!',
      });
    userMemberToken = resMember.body.token;
    userMemberId = resMember.body.user.id;

    // 4. Create Outsider User (no initial affiliation with Alpha Corp)
    const resOutsider = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'David Outsider',
        email: 'david.outsider@taskflow.dev',
        password: 'Password123!',
        workspaceName: 'Omega Labs',
      });
    userOutsiderToken = resOutsider.body.token;
    userOutsiderId = resOutsider.body.user.id;
    secondaryWorkspaceId = resOutsider.body.workspace?.id || resOutsider.body.user.currentWorkspaceId;
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('1. Workspace Creation and Retrieval', () => {
    it('1. Owner can fetch primary workspace details', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${primaryWorkspaceId}`)
        .set('Authorization', `Bearer ${userOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.workspace).toHaveProperty('id', primaryWorkspaceId);
      expect(res.body.workspace).toHaveProperty('name', 'Alpha Corp');
      expect(res.body.workspace).toHaveProperty('isOwner', true);
      expect(res.body.workspace).toHaveProperty('role', 'Owner');
      expect(res.body.workspace.members.length).toBe(1);

      primaryInviteCode = res.body.workspace.inviteCode;
      expect(primaryInviteCode).toBeDefined();
    });

    it('2. Authenticated user can create an additional workspace', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userOwnerToken}`)
        .send({
          name: 'Stark Industries',
          description: 'Advanced engineering division',
          color: '#e02424',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.workspace).toHaveProperty('name', 'Stark Industries');
      expect(res.body.workspace).toHaveProperty('isOwner', true);
      expect(res.body.workspace).toHaveProperty('role', 'Owner');
      expect(res.body.workspace).toHaveProperty('_id');
      expect(res.body.workspace._id).toBe(res.body.workspace.id);
    });

    it('3. Workspace creation rejects name shorter than 2 characters', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userOwnerToken}`)
        .send({
          name: 'A',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });

    it('4. User can list all workspaces they are a member of', async () => {
      const res = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${userOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('count');
      expect(res.body.count).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(res.body.workspaces)).toBe(true);
      expect(res.body.workspaces[0]).toHaveProperty('_id');
      expect(res.body.workspaces[0]).toHaveProperty('role');
    });

    it('5. User can fetch their current active workspace', async () => {
      const res = await request(app)
        .get('/api/workspaces/current')
        .set('Authorization', `Bearer ${userOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.workspace).toBeDefined();
      expect(res.body.workspace).toHaveProperty('id');
    });
  });

  describe('2. Multi-Tenant Cross-Workspace Isolation', () => {
    it('1. Outsider cannot access Alpha Corp details (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${primaryWorkspaceId}`)
        .set('Authorization', `Bearer ${userOutsiderToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('not have access');
    });

    it('2. Requesting a non-existent workspace returns 404 Not Found', async () => {
      const res = await request(app)
        .get('/api/workspaces/non_existent_cuid_123456789')
        .set('Authorization', `Bearer ${userOwnerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('success', false);
    });

    it('3. Outsider cannot update Alpha Corp settings (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/workspaces/${primaryWorkspaceId}`)
        .set('Authorization', `Bearer ${userOutsiderToken}`)
        .send({
          name: 'Hacked Corp',
        });

      expect(res.status).toBe(403);
    });

    it('4. Outsider cannot delete Alpha Corp (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${primaryWorkspaceId}`)
        .set('Authorization', `Bearer ${userOutsiderToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('3. Workspace Membership Onboarding & Invite Code', () => {
    it('1. Owner adds Bob as Admin by email', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${primaryWorkspaceId}/members`)
        .set('Authorization', `Bearer ${userOwnerToken}`)
        .send({
          email: 'bob.admin@taskflow.dev',
          role: 'Admin',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.member).toHaveProperty('role', 'Admin');
      expect(res.body.member.user).toHaveProperty('email', 'bob.admin@taskflow.dev');
    });

    it('2. Adding an already existing member returns 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${primaryWorkspaceId}/members`)
        .set('Authorization', `Bearer ${userOwnerToken}`)
        .send({
          email: 'bob.admin@taskflow.dev',
          role: 'Member',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already a member');
    });

    it('3. Adding a non-existent email returns 404 Not Found', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${primaryWorkspaceId}/members`)
        .set('Authorization', `Bearer ${userOwnerToken}`)
        .send({
          email: 'ghost_user@taskflow.dev',
          role: 'Member',
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('4. Charlie joins Alpha Corp using the workspace invite code', async () => {
      const res = await request(app)
        .post('/api/workspaces/join')
        .set('Authorization', `Bearer ${userMemberToken}`)
        .send({
          inviteCode: primaryInviteCode,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.workspace).toHaveProperty('id', primaryWorkspaceId);
      expect(res.body.workspace.members.some((m) => m.user.id === userMemberId)).toBe(true);
    });

    it('5. Joining with an invalid invite code returns 404 Not Found', async () => {
      const res = await request(app)
        .post('/api/workspaces/join')
        .set('Authorization', `Bearer ${userOutsiderToken}`)
        .send({
          inviteCode: 'invalid_code_999',
        });

      expect(res.status).toBe(404);
    });

    it('6. Re-joining via invite code when already a member returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/workspaces/join')
        .set('Authorization', `Bearer ${userMemberToken}`)
        .send({
          inviteCode: primaryInviteCode,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already a member');
    });

    it('7. Any workspace member can list the workspace roster', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${primaryWorkspaceId}/members`)
        .set('Authorization', `Bearer ${userMemberToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('count', 3);
      expect(res.body.members.length).toBe(3);
      expect(res.body.members[0]).toHaveProperty('_id');
      expect(res.body.members[0].user).toHaveProperty('_id');
    });
  });

  describe('4. Role-Based Access Control (RBAC) & Hierarchy Enforcement', () => {
    it('1. Admin can update workspace settings (name, description, color)', async () => {
      const res = await request(app)
        .put(`/api/workspaces/${primaryWorkspaceId}`)
        .set('Authorization', `Bearer ${userAdminToken}`)
        .send({
          name: 'Alpha Corp International',
          description: 'Updated by Bob Admin',
          color: '#10b981',
        });

      expect(res.status).toBe(200);
      expect(res.body.workspace).toHaveProperty('name', 'Alpha Corp International');
    });

    it('2. Regular Member CANNOT update workspace settings (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/workspaces/${primaryWorkspaceId}`)
        .set('Authorization', `Bearer ${userMemberToken}`)
        .send({
          name: 'Charlie Corp',
        });

      expect(res.status).toBe(403);
    });

    it('3. Regular Member CANNOT invite new members (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${primaryWorkspaceId}/members`)
        .set('Authorization', `Bearer ${userMemberToken}`)
        .send({
          email: 'david.outsider@taskflow.dev',
          role: 'Viewer',
        });

      expect(res.status).toBe(403);
    });

    it('4. Admin CANNOT promote someone to Owner (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/workspaces/${primaryWorkspaceId}/members/${userMemberId}`)
        .set('Authorization', `Bearer ${userAdminToken}`)
        .send({
          role: 'Owner',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Owner');
    });

    it('5. Admin CANNOT modify or demote an Owner (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/workspaces/${primaryWorkspaceId}/members/${userOwnerId}`)
        .set('Authorization', `Bearer ${userAdminToken}`)
        .send({
          role: 'Member',
        });

      expect(res.status).toBe(403);
    });

    it('6. Admin can change Charlie from Member to Viewer', async () => {
      const res = await request(app)
        .put(`/api/workspaces/${primaryWorkspaceId}/members/${userMemberId}`)
        .set('Authorization', `Bearer ${userAdminToken}`)
        .send({
          role: 'Viewer',
        });

      expect(res.status).toBe(200);
      expect(res.body.member).toHaveProperty('role', 'Viewer');
    });

    it('7. Owner CANNOT demote themselves when they are the only Owner (400 Bad Request)', async () => {
      const res = await request(app)
        .put(`/api/workspaces/${primaryWorkspaceId}/members/${userOwnerId}`)
        .set('Authorization', `Bearer ${userOwnerToken}`)
        .send({
          role: 'Member',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot demote the last owner');
    });
  });

  describe('5. Member Removal, Workspace Switching & Leaving', () => {
    it('1. Member can switch their active workspace', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${primaryWorkspaceId}/switch`)
        .set('Authorization', `Bearer ${userMemberToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('2. Admin cannot remove an Owner (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${primaryWorkspaceId}/members/${userOwnerId}`)
        .set('Authorization', `Bearer ${userAdminToken}`);

      expect(res.status).toBe(403);
    });

    it('3. Admin can remove Charlie (Viewer) from workspace', async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${primaryWorkspaceId}/members/${userMemberId}`)
        .set('Authorization', `Bearer ${userAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);

      // Verify Charlie is no longer a member
      const checkRes = await request(app)
        .get(`/api/workspaces/${primaryWorkspaceId}/members`)
        .set('Authorization', `Bearer ${userOwnerToken}`);
      expect(checkRes.body.members.some((m) => m.user.id === userMemberId)).toBe(false);
    });

    it('4. Sole Owner cannot leave workspace without transferring ownership (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${primaryWorkspaceId}/leave`)
        .set('Authorization', `Bearer ${userOwnerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('only Owner');
    });

    it('5. Bob Admin can leave workspace voluntarily', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${primaryWorkspaceId}/leave`)
        .set('Authorization', `Bearer ${userAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('6. Ownership Transfer and Workspace Deletion', () => {
    let temporaryWorkspaceId = null;

    beforeAll(async () => {
      // Re-add Bob to Alpha Corp
      await request(app)
        .post(`/api/workspaces/${primaryWorkspaceId}/members`)
        .set('Authorization', `Bearer ${userOwnerToken}`)
        .send({
          email: 'bob.admin@taskflow.dev',
          role: 'Admin',
        });

      // Create a temporary workspace to test deletion
      const tempRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userOwnerToken}`)
        .send({
          name: 'Disposable Workspace',
        });
      temporaryWorkspaceId = tempRes.body.workspace.id;
    });

    it('1. Owner can transfer workspace ownership to Bob', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${primaryWorkspaceId}/transfer-ownership`)
        .set('Authorization', `Bearer ${userOwnerToken}`)
        .send({
          newOwnerId: userAdminId,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.workspace).toHaveProperty('ownerId', userAdminId);

      // Verify Bob is now Owner and Alice is Admin
      const rosterRes = await request(app)
        .get(`/api/workspaces/${primaryWorkspaceId}/members`)
        .set('Authorization', `Bearer ${userAdminToken}`);

      const bobMember = rosterRes.body.members.find((m) => m.user.id === userAdminId);
      const aliceMember = rosterRes.body.members.find((m) => m.user.id === userOwnerId);

      expect(bobMember.role).toBe('Owner');
      expect(aliceMember.role).toBe('Admin');
    });

    it('2. Transfer ownership fails if target user is not a member of the workspace (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${primaryWorkspaceId}/transfer-ownership`)
        .set('Authorization', `Bearer ${userAdminToken}`)
        .send({
          newOwnerId: userOutsiderId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('active member');
    });

    it('3. Non-owner (Alice, now Admin) CANNOT delete the workspace (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${primaryWorkspaceId}`)
        .set('Authorization', `Bearer ${userOwnerToken}`); // Alice is now Admin

      expect(res.status).toBe(403);
    });

    it('4. Owner can permanently delete a workspace', async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${temporaryWorkspaceId}`)
        .set('Authorization', `Bearer ${userOwnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);

      // Verify it is gone
      const verifyRes = await request(app)
        .get(`/api/workspaces/${temporaryWorkspaceId}`)
        .set('Authorization', `Bearer ${userOwnerToken}`);

      expect(verifyRes.status).toBe(404);
    });
  });

  describe('7. Security Hardening & Concurrency Invariants', () => {
    it('1. Conflicting workspace IDs across route param and x-workspace-id header are rejected with 400', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${primaryWorkspaceId}`)
        .set('Authorization', `Bearer ${userAdminToken}`)
        .set('x-workspace-id', secondaryWorkspaceId); // Contradictory ID

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('Conflicting workspace identifiers');
    });

    it('2. Matching x-workspace-id header and route parameter is accepted', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${primaryWorkspaceId}`)
        .set('Authorization', `Bearer ${userAdminToken}`)
        .set('x-workspace-id', primaryWorkspaceId); // Matching ID

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('3. User cannot access another workspace by spoofing x-workspace-id', async () => {
      const res = await request(app)
        .get('/api/workspaces/current')
        .set('Authorization', `Bearer ${userOutsiderToken}`)
        .set('x-workspace-id', primaryWorkspaceId); // Outsider attempts to access primary workspace

      // Outsider is not a member of primary workspace; current should ignore unauthorized header and return their own
      expect(res.status).toBe(200);
      expect(res.body.workspace.id).toBe(secondaryWorkspaceId);
    });

    it('4. Two concurrent demotion requests cannot violate the single last-owner invariant', async () => {
      // Bob is currently the only Owner of primaryWorkspaceId (Alice is Admin)
      // Attempt two parallel requests to demote Bob to Member simultaneously
      const [res1, res2] = await Promise.all([
        request(app)
          .put(`/api/workspaces/${primaryWorkspaceId}/members/${userAdminId}`)
          .set('Authorization', `Bearer ${userAdminToken}`)
          .send({ role: 'Member' }),
        request(app)
          .put(`/api/workspaces/${primaryWorkspaceId}/members/${userAdminId}`)
          .set('Authorization', `Bearer ${userAdminToken}`)
          .send({ role: 'Member' }),
      ]);

      // Both should be rejected because Bob is the only Owner
      expect(res1.status).toBe(400);
      expect(res2.status).toBe(400);
      expect(res1.body.message).toContain('Cannot demote the last owner');
      expect(res2.body.message).toContain('Cannot demote the last owner');

      // Verify Bob remains Owner
      const checkRoster = await request(app)
        .get(`/api/workspaces/${primaryWorkspaceId}/members`)
        .set('Authorization', `Bearer ${userAdminToken}`);

      const bob = checkRoster.body.members.find((m) => m.user.id === userAdminId);
      expect(bob.role).toBe('Owner');
    });

    it('5. Joining via invite code hardcodes role to Member regardless of body tampering', async () => {
      // Register a brand new user to join via invite code
      const newUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Eve Hacker',
          email: 'eve.hacker@taskflow.dev',
          password: 'Password123!',
        });
      const eveToken = newUserRes.body.token;
      const eveId = newUserRes.body.user.id;

      // Eve attempts to inject role: 'Owner' into the join payload
      const joinRes = await request(app)
        .post('/api/workspaces/join')
        .set('Authorization', `Bearer ${eveToken}`)
        .send({
          inviteCode: primaryInviteCode,
          role: 'Owner', // Attempted escalation
        });

      expect(joinRes.status).toBe(200);

      // Verify Eve's actual assigned role in the workspace is strictly Member
      const roster = await request(app)
        .get(`/api/workspaces/${primaryWorkspaceId}/members`)
        .set('Authorization', `Bearer ${userAdminToken}`);

      const eveMember = roster.body.members.find((m) => m.user.id === eveId);
      expect(eveMember).toBeDefined();
      expect(eveMember.role).toBe('Member');
    });
  });
});

