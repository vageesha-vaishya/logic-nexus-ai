import request from 'supertest';
import app from '../src/app';

describe('AMRO Stock Ledger Routes', () => {
  it('exposes stock-ledger list route (not 404)', async () => {
    const response = await request(app)
      .get('/api/v2/amro/stock-ledger?page=1&page_size=1')
      .set('x-user-id', 'stock-ledger-user')
      .set('x-tenant-id', 'stock-ledger-tenant');
    expect(response.status).not.toBe(404);
  });

  it('exposes stock-balance report route (not 404)', async () => {
    const response = await request(app)
      .get('/api/v2/amro/stock-ledger/reports/stock-balance')
      .set('x-user-id', 'stock-ledger-user')
      .set('x-tenant-id', 'stock-ledger-tenant');
    expect(response.status).not.toBe(404);
  });

  it('exposes period and approval routes (not 404)', async () => {
    const periods = await request(app)
      .get('/api/v2/amro/stock-ledger/periods')
      .set('x-user-id', 'stock-ledger-user')
      .set('x-tenant-id', 'stock-ledger-tenant');
    const approvals = await request(app)
      .get('/api/v2/amro/stock-ledger/approvals')
      .set('x-user-id', 'stock-ledger-user')
      .set('x-tenant-id', 'stock-ledger-tenant');
    expect(periods.status).not.toBe(404);
    expect(approvals.status).not.toBe(404);
  });

  it('exposes audit export route (not 404)', async () => {
    const response = await request(app)
      .get('/api/v2/amro/stock-ledger/audit/export')
      .set('x-user-id', 'stock-ledger-user')
      .set('x-tenant-id', 'stock-ledger-tenant');
    expect(response.status).not.toBe(404);
  });
});
