import request from 'supertest';
import app from '../src/app.js';

describe('Health and Application Foundation Tests', () => {
  it('GET /api/health should return 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('app', 'TaskFlow API Server');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/non-existent-route should return 404 with structured ApiError', async () => {
    const res = await request(app).get('/api/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('not found');
  });
});

