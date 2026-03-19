/**
 * Work Orders API Integration Tests
 * Tests API endpoints with mocked Supabase responses
 */

import request from 'supertest';
import app from '../src/app';

describe('AMRO API Health Check', () => {
  it('should return 200 OK on GET /health', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('amro-api');
  });

  it('should return service info on GET /', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('AMRO API Service');
    expect(response.body.version).toBe('0.1.0');
  });
});

describe('Authentication Middleware', () => {
  it('should return 401 when Authorization header is missing', async () => {
    const response = await request(app).get('/api/v1/work-packages');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should return 401 when Authorization header is malformed', async () => {
    const response = await request(app)
      .get('/api/v1/work-packages')
      .set('Authorization', 'InvalidToken');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should return 401 when Authorization header has no Bearer prefix', async () => {
    const response = await request(app)
      .get('/api/v1/work-packages')
      .set('Authorization', 'InvalidTokenFormat');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });
});

describe('Error Handling', () => {
  it('should return 404 for unknown non-API routes', async () => {
    const response = await request(app).get('/unknown-endpoint');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('should return appropriate error format for 404', async () => {
    const response = await request(app).get('/unknown-endpoint');
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('code');
    expect(response.body).toHaveProperty('statusCode');
    expect(response.body.statusCode).toBe(404);
  });

  it('should return 401 for unknown API routes without token (auth middleware protection)', async () => {
    const response = await request(app).get('/api/v1/unknown-endpoint');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });
});

describe('CORS Headers', () => {
  it('should include CORS headers in response', async () => {
    const response = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:3000');
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  it('should allow OPTIONS requests on health endpoint', async () => {
    const response = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:3000');
    expect(response.status).toBe(204);
  });
});

describe('Work Packages Endpoints - Authentication Required', () => {
  it('should require authentication for GET /api/v1/work-packages', async () => {
    const response = await request(app).get('/api/v1/work-packages');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should require authentication for POST /api/v1/work-packages', async () => {
    const response = await request(app).post('/api/v1/work-packages').send({
      aircraft_id: 'ac-123',
      title: 'Test WP',
      maintenance_type: 'line',
    });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should require authentication for GET /api/v1/work-packages/:id', async () => {
    const response = await request(app).get('/api/v1/work-packages/wp-123');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should require authentication for PATCH /api/v1/work-packages/:id', async () => {
    const response = await request(app)
      .patch('/api/v1/work-packages/wp-123')
      .send({ title: 'Updated' });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should require authentication for DELETE /api/v1/work-packages/:id', async () => {
    const response = await request(app).delete('/api/v1/work-packages/wp-123');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });
});

describe('Tasks Endpoints - Authentication Required', () => {
  it('should require authentication for GET /api/v1/work-packages/:id/tasks', async () => {
    const response = await request(app).get(
      '/api/v1/work-packages/wp-123/tasks',
    );
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should require authentication for POST /api/v1/work-packages/:id/tasks', async () => {
    const response = await request(app)
      .post('/api/v1/work-packages/wp-123/tasks')
      .send({
        title: 'Test Task',
        sequence_number: 1,
      });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should require authentication for GET /api/v1/tasks/:id', async () => {
    const response = await request(app).get('/api/v1/tasks/task-123');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should require authentication for PATCH /api/v1/tasks/:id', async () => {
    const response = await request(app)
      .patch('/api/v1/tasks/task-123')
      .send({ status: 'in_progress' });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should require authentication for DELETE /api/v1/tasks/:id', async () => {
    const response = await request(app).delete('/api/v1/tasks/task-123');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });
});
