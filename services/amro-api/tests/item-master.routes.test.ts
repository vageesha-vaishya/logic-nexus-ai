import request from 'supertest';
import app from '../src/app';

describe('AMRO Item Master Routes', () => {
  it('exposes /api/v2/amro/item-master route (not 404)', async () => {
    const response = await request(app)
      .get('/api/v2/amro/item-master?page=1&page_size=1')
      .set('x-user-id', 'item-master-user')
      .set('x-tenant-id', 'item-master-tenant');

    expect(response.status).not.toBe(404);
  });
});
