import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/database/prisma.client.js';
import { cleanDatabase } from '../src/database/test-helper.js';

describe('Authentication and User Management Integration Tests', () => {
  let authCookie = null;
  let authToken = null;
  let rawRefreshToken = null;
  let createdUserId = null;

  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('1. Registration Flow', () => {
    it('1. Successful registration creates user, workspace, and issues credentials', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Sarah Connor',
          email: 'sarah.connor@taskflow.dev',
          password: 'Password123!',
          workspaceName: 'Cyberdyne Resistance',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', 'sarah.connor@taskflow.dev');
      expect(res.body.user).toHaveProperty('name', 'Sarah Connor');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('_id');
      expect(res.body.user._id).toBe(res.body.user.id);

      // Verify cookie was set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith('token='))).toBe(true);

      authToken = res.body.token;
      createdUserId = res.body.user.id;

      // Extract raw refresh token from set-cookie for subsequent tests
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      if (refreshCookie) {
        rawRefreshToken = refreshCookie.split(';')[0].replace('refreshToken=', '');
      }
    });

    it('2. Duplicate email rejection prevents re-registering same account', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another Sarah',
          email: 'SARAH.CONNOR@taskflow.dev', // case-insensitive check
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('already exists');
    });

    it('3. Invalid registration input rejects short password or invalid email', async () => {
      const resShortPass = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: '123', // too short (< 6 chars)
        });

      expect(resShortPass.status).toBe(400);
      expect(resShortPass.body).toHaveProperty('success', false);

      const resBadEmail = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'not-an-email',
          password: 'Password123!',
        });

      expect(resBadEmail.status).toBe(400);
      expect(resBadEmail.body).toHaveProperty('success', false);
    });
  });

  describe('2. Login and Credential Verification', () => {
    it('4. Successful login returns access token and sets HTTP-only cookies', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'sarah.connor@taskflow.dev',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('id', createdUserId);

      authToken = res.body.token;

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = cookies.find((c) => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      authCookie = tokenCookie.split(';')[0];

      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      if (refreshCookie) {
        rawRefreshToken = refreshCookie.split(';')[0].replace('refreshToken=', '');
      }
    });

    it('5. Incorrect password rejection returns 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'sarah.connor@taskflow.dev',
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('Invalid email or password');
    });
  });

  describe('3. Token Verification and Authentication Middleware', () => {
    it('6. Access-token authentication succeeds via Bearer header and Cookie', async () => {
      // Test via Authorization header
      const resHeader = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(resHeader.status).toBe(200);
      expect(resHeader.body.user).toHaveProperty('email', 'sarah.connor@taskflow.dev');
      expect(Array.isArray(resHeader.body.workspaces)).toBe(true);
      expect(resHeader.body.workspaces.length).toBeGreaterThan(0);
      expect(resHeader.body.workspaces[0]).toHaveProperty('isOwner', true);

      // Test via Cookie
      const resCookie = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie);

      expect(resCookie.status).toBe(200);
      expect(resCookie.body.user).toHaveProperty('id', createdUserId);
    });

    it('7. Expired or invalid token rejection returns 401 Unauthorized', async () => {
      const resInvalid = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer totally.invalid.jwt.token');

      expect(resInvalid.status).toBe(401);
      expect(resInvalid.body).toHaveProperty('success', false);
    });
  });

  describe('4. Refresh Token Lifecycle, Rotation, and Reuse Detection', () => {
    let secondRefreshToken = null;

    it('8. Successful token refresh rotates credentials and issues new access token', async () => {
      expect(rawRefreshToken).toBeDefined();

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('refreshToken');

      secondRefreshToken = res.body.refreshToken;
      expect(secondRefreshToken).not.toBe(rawRefreshToken);
    });

    it('9. Refresh-token rotation: new token works for subsequent refresh', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: secondRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
    });

    it('10. Reuse of revoked refresh token triggers reuse detection and 401 Unauthorized', async () => {
      // Attempting to reuse the first (already rotated/revoked) refresh token
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('Revoked refresh token reused');

      // Verify that all refresh tokens for this user were revoked
      const activeTokensCount = await prisma.refreshToken.count({
        where: {
          userId: createdUserId,
          revokedAt: null,
        },
      });
      expect(activeTokensCount).toBe(0);
    });
  });

  describe('5. Logout and Session Invalidation', () => {
    it('11. Logout clears cookies and revokes active token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);

      // Verify cookies are expired/cleared
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = cookies.find((c) => c.startsWith('token='));
      expect(tokenCookie).toContain('Expires=');
    });
  });

  describe('6. Protected Route Access and User Management', () => {
    let freshToken = null;

    beforeAll(async () => {
      // Log in again to get fresh valid access token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'sarah.connor@taskflow.dev',
          password: 'Password123!',
        });
      freshToken = loginRes.body.token;
    });

    it('12. Protected route access rejects unauthenticated requests and permits valid ones', async () => {
      // Unauthenticated
      const unauth = await request(app).get('/api/users');
      expect(unauth.status).toBe(401);

      // Authenticated
      const auth = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${freshToken}`);

      expect(auth.status).toBe(200);
      expect(auth.body).toHaveProperty('success', true);
      expect(Array.isArray(auth.body.users)).toBe(true);
      expect(auth.body.users.length).toBeGreaterThan(0);
    });

    it('13. User profile retrieval and update allows modifying profile and password', async () => {
      // Update profile
      const updateRes = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          name: 'Sarah Connor (Resistance Leader)',
          jobTitle: 'Commander',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.user).toHaveProperty('name', 'Sarah Connor (Resistance Leader)');
      expect(updateRes.body.user).toHaveProperty('jobTitle', 'Commander');

      // Verify with GET /api/users/:id
      const getRes = await request(app)
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${freshToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.user).toHaveProperty('name', 'Sarah Connor (Resistance Leader)');

      // Change password
      const pwRes = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword456!',
        });

      expect(pwRes.status).toBe(200);
      expect(pwRes.body).toHaveProperty('success', true);

      // Verify login works with new password
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'sarah.connor@taskflow.dev',
          password: 'NewPassword456!',
        });

      expect(newLoginRes.status).toBe(200);
    });

    it('14. Password hash NEVER appears in API responses', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${freshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).not.toHaveProperty('password');

      const responseString = JSON.stringify(res.body);
      expect(responseString.includes('$2a$')).toBe(false);
      expect(responseString.includes('$2b$')).toBe(false);
      expect(responseString.toLowerCase().includes('hash')).toBe(false);
    });
  });
});

