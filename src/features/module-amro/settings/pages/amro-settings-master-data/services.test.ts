import { describe, expect, it } from 'vitest';
import { filterAssemblyModelsByScope, filterManufacturersByTenant } from './services';

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

describe('filterAssemblyModelsByScope', () => {
  it('returns only active models matching tenant-manufacturer and franchise scope', () => {
    const records = [
      { id: 'm1', tenantId: 'tenant-1', franchiseId: 'fr-1', manufacturerId: 'manu-2', active: true },
      { id: 'm2', tenantId: 'tenant-1', franchiseId: '', manufacturerId: 'manu-2', active: true },
      { id: 'm3', tenantId: 'tenant-1', franchiseId: 'fr-2', manufacturerId: 'manu-2', active: true },
      { id: 'm4', tenantId: 'tenant-1', franchiseId: 'fr-1', manufacturerId: 'manu-1', active: true },
      { id: 'm5', tenantId: 'tenant-2', franchiseId: 'fr-3', manufacturerId: 'manu-2', active: true },
      { id: 'm6', tenantId: 'tenant-1', franchiseId: 'fr-1', manufacturerId: 'manu-2', active: false },
    ];
    const scoped = filterAssemblyModelsByScope(records, {
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      manufacturerId: 'manu-2',
    });
    expect(scoped.map((record) => record.id)).toEqual(['m1', 'm2']);
  });

  it('returns no models when any required scope key is missing', () => {
    const records = [{ id: 'm1', tenantId: 'tenant-1', franchiseId: 'fr-1', manufacturerId: 'manu-2', active: true }];
    expect(filterAssemblyModelsByScope(records, { tenantId: '', franchiseId: 'fr-1', manufacturerId: 'manu-2' })).toEqual([]);
    expect(filterAssemblyModelsByScope(records, { tenantId: 'tenant-1', franchiseId: '', manufacturerId: 'manu-2' })).toEqual([]);
    expect(filterAssemblyModelsByScope(records, { tenantId: 'tenant-1', franchiseId: 'fr-1', manufacturerId: '' })).toEqual([]);
  });
});
