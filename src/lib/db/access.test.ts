
import { describe, it, expect } from 'vitest';
import { withScope } from './access';

describe('Data Access Security', () => {
  const createMockQuery = () => ({
    eq: function(key: string, value: any) {
      this.filters[key] = value;
      return this;
    },
    filters: {} as Record<string, any>
  });

  it('Platform Admin gets raw query', () => {
    const query = createMockQuery();
    const result = withScope(query, { isPlatformAdmin: true, isTenantAdmin: false, isFranchiseAdmin: false });
    expect(result).toBe(query);
    expect(result.filters).toEqual({});
  });

  it('Tenant Admin gets tenant scope', () => {
    const query = createMockQuery();
    const result = withScope(query, { 
      isPlatformAdmin: false, 
      isTenantAdmin: true, 
      isFranchiseAdmin: false,
      tenantId: 'tenant-1'
    });
    // @ts-ignore
    expect(result.filters).toEqual({ tenant_id: 'tenant-1' });
  });

  it('Franchise Admin gets tenant and franchise scope', () => {
    const query = createMockQuery();
    const result = withScope(query, { 
      isPlatformAdmin: false, 
      isTenantAdmin: false, 
      isFranchiseAdmin: true,
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1'
    });
    // @ts-ignore
    expect(result.filters).toEqual({ 
      tenant_id: 'tenant-1',
      franchise_id: 'franchise-1' 
    });
  });
});
