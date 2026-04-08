import request from 'supertest';
import app from '../src/app';

describe('AMRO Parts Payload Policy', () => {
  it('rejects non-inventory fields on POST /api/v2/amro/parts', async () => {
    const response = await request(app)
      .post('/api/v2/amro/parts')
      .set('x-user-id', 'audit-user')
      .set('x-tenant-id', 'audit-tenant')
      .send({
        part_number: 'AMRO-PN-INV-001',
        warehouse_location: 'WH-A-001',
        supplier_name: 'Non-inventory field',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details?.rejected_non_inventory_fields).toContain('supplier_name');
  });

  it('rejects non-inventory fields on PATCH /api/v2/amro/parts/:id', async () => {
    const response = await request(app)
      .patch('/api/v2/amro/parts/inv-123')
      .set('x-user-id', 'audit-user')
      .set('x-tenant-id', 'audit-tenant')
      .send({
        unit_cost: 1200,
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details?.rejected_non_inventory_fields).toContain('unit_cost');
  });

  it('rejects unknown payload fields with explicit diagnostics', async () => {
    const response = await request(app)
      .post('/api/v2/amro/parts')
      .set('x-user-id', 'audit-user')
      .set('x-tenant-id', 'audit-tenant')
      .send({
        part_number: 'AMRO-PN-INV-002',
        warehouse_location: 'WH-A-002',
        unsupported_field: 'x',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details?.rejected_unknown_fields).toContain('unsupported_field');
  });
});
