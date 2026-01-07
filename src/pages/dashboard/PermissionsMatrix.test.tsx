import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, type Permission } from '@/config/permissions';

describe('PermissionsMatrix module list', () => {
  it('includes Shipments module in computed modules set', () => {
    const allPerms = new Set<Permission>();
    (['platform_admin','tenant_admin','franchise_admin','user'] as const).forEach((r) => {
      ROLE_PERMISSIONS[r].forEach((p) => allPerms.add(p));
    });
    const byModule = new Map<string, Set<string>>();
    for (const perm of allPerms) {
      const [module, action] = perm.split('.') as [string, string];
      if (!byModule.has(module)) byModule.set(module, new Set());
      byModule.get(module)!.add(action);
    }
    const modules = Array.from(byModule.keys());
    expect(modules.includes('shipments')).toBe(true);
  });
});
