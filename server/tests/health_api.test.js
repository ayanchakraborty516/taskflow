const request = require('supertest');
const app = require('../src/app');
require('./setup');

describe('System Health & API Foundation', () => {
  it('GET /api/health should return 200 with healthy status and metadata', async () => {
    const res = await request(app).get('/api/health');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
    expect(res.body.app).toBe('TaskFlow API Server');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
  });

  it('GET /api/unknown-endpoint should return 404 with error message', async () => {
    const res = await request(app).get('/api/non-existent-route');

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('API endpoint not found');
  });

  it('Protected routes without token should return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/workspaces');

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Not authorized/i);
  });
});
