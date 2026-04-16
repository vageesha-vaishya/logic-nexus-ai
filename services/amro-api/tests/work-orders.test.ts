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

  it('should return readiness payload on GET /health/ready', async () => {
    const response = await request(app).get('/health/ready');
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty('dependencies');
    expect(response.body).toHaveProperty('resilience');
  });

  it('should return monitoring metrics on GET /health/metrics', async () => {
    const response = await request(app).get('/health/metrics');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('totals');
    expect(response.body).toHaveProperty('window');
  });
});

describe('AMRO API Contract Artifacts', () => {
  it('should return OpenAPI contract without Authorization header', async () => {
    const response = await request(app).get('/api/v2/amro/contracts/openapi-3.1.yaml');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/yaml');
    expect(response.text).toContain('openapi: 3.1.0');
  });

  it('should return 404 for unknown contract artifact path', async () => {
    const response = await request(app).get('/api/v2/amro/contracts/unknown-artifact.yaml');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});

describe('AMRO Public Contract and Readiness APIs', () => {
  it('should return phase plan without Authorization header', async () => {
    const response = await request(app).get('/api/v2/amro/phase-plan');
    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('phase-plan');
    expect(response.body.domainAccess?.subscriptionStatus).toBe('public');
  });

  it('should return phase 1 readiness without Authorization header', async () => {
    const response = await request(app).get('/api/v2/amro/phase-1-readiness');
    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('phase-1-readiness');
    expect(response.body.domainAccess?.subscriptionStatus).toBe('public');
  });

  it('should return module catalog without Authorization header', async () => {
    const response = await request(app).get('/api/v2/amro/module-catalog');
    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('module-catalog');
    expect(response.body.domainAccess?.subscriptionStatus).toBe('public');
  });

  it('should return screen inventory without Authorization header', async () => {
    const response = await request(app).get('/api/v2/amro/screen-inventory');
    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('screen-inventory');
    expect(response.body.domainAccess?.subscriptionStatus).toBe('public');
  });

  it('should return migration plan without Authorization header', async () => {
    const response = await request(app).get('/api/v2/amro/migration-plan');
    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('migration-plan');
    expect(response.body.domainAccess?.subscriptionStatus).toBe('public');
  });

  it('should return contract health without Authorization header', async () => {
    const response = await request(app).get('/api/v2/amro/health');
    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('health');
    expect(response.body.domainAccess?.subscriptionStatus).toBe('public');
  });

  it('should return v2 monitoring metrics without Authorization header', async () => {
    const response = await request(app).get('/api/v2/amro/health/metrics');
    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('metrics');
    expect(response.body).toHaveProperty('totals');
  });
});

describe('AMRO Aircraft Dashboard API', () => {
  it('should resolve engine operations dashboard without Not Found when tenant scope headers are provided in test mode', async () => {
    const response = await request(app)
      .get('/api/v2/amro/aircraft-dashboard?module=engine&due_within_days=30&trend_days=14')
      .set('x-user-id', 'test-user')
      .set('x-tenant-id', 'test-tenant');

    expect(response.status).toBe(200);
    expect(response.body.interface).toBe('load-aircraft-lead-dashboard');
    expect(response.body.error).toBeUndefined();
    expect(response.body.output).toBeDefined();
    expect(response.body.output.engine_module).not.toBeNull();
    expect(Array.isArray(response.body.output.aircraft_status)).toBe(true);
    if (response.body.output.aircraft_status.length > 0) {
      expect(Object.prototype.hasOwnProperty.call(response.body.output.aircraft_status[0], 'assembly_models')).toBe(true);
    }
    expect(response.body.output.engine_module).toHaveProperty('kpis');
    expect(response.body.output.engine_module).toHaveProperty('maintenance_schedule');
    expect(response.body.output.engine_module).toHaveProperty('work_orders');
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

  it('should no longer return 404 for GET /api/v2/amro/parts when unauthorized', async () => {
    const response = await request(app).get('/api/v2/amro/parts?page=1&page_size=25');
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

describe('Materials and Maintenance Event Endpoints - Authentication Required', () => {
  it('should require authentication for GET /api/v1/work-packages/:id/materials', async () => {
    const response = await request(app).get('/api/v1/work-packages/wp-123/materials');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should require authentication for GET /api/v1/materials/:id', async () => {
    const response = await request(app).get('/api/v1/materials/material-123');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });

  it('should require authentication for POST /api/v1/tasks/:id/maintenance-events', async () => {
    const response = await request(app)
      .post('/api/v1/tasks/task-123/maintenance-events')
      .send({
        executed_by: 'user-123',
        evidence_captured: true,
      });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('MISSING_TOKEN');
  });
});
