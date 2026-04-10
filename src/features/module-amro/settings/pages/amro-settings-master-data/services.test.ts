import { describe, expect, it } from 'vitest';
import { filterManufacturersByTenant } from './services';

describe('filterManufacturersByTenant', () => {
  it('returns only global and tenant-matching manufacturers', () => {
    const records = [
      { id: 'm-global', tenantId: '' },
      { id: 'm-t1', tenantId: 'tenant-1' },
      { id: 'm-t2', tenantId: 'tenant-2' },
    ];
    const scoped = filterManufacturersByTenant(records, 'tenant-1');
    expect(scoped.map((record) => record.id)).toEqual(['m-global', 'm-t1']);
  });

  it('returns all manufacturers when tenant filter is empty', () => {
    const records = [
      { id: 'm-t1', tenantId: 'tenant-1' },
      { id: 'm-t2', tenantId: 'tenant-2' },
    ];
    const scoped = filterManufacturersByTenant(records, '');
    expect(scoped).toEqual(records);
  });
});
