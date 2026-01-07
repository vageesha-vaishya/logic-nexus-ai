import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, unionPermissions, type Permission } from '@/config/permissions';

describe('Dynamic Role Permissions with Inheritance', () => {
  it('combines base and inherited permissions from parent roles', () => {
    // Mock dynamic map: franchise_admin has limited, tenant_admin broader
    const dynamicMap: Record<string, Permission[]> = {
      tenant_admin: ROLE_PERMISSIONS.tenant_admin,
      franchise_admin: ROLE_PERMISSIONS.franchise_admin,
      user: ROLE_PERMISSIONS.user,
    };
    // Child -> Parents mapping
    const childrenToParents: Record<string, string[]> = {
      franchise_admin: ['tenant_admin'],
      user: ['franchise_admin'],
    };

    const roles = ['user'];
    const collectAncestors = (roleId: string, visited = new Set<string>()): string[] => {
      if (visited.has(roleId)) return [];
      visited.add(roleId);
      const direct = childrenToParents[roleId] || [];
      const all = [...direct];
      direct.forEach(pr => {
        all.push(...collectAncestors(pr, visited));
      });
      return Array.from(new Set(all));
    };
    const resolved = unionPermissions(
      ...roles.map(r => {
        const base = dynamicMap[r] || ROLE_PERMISSIONS[r as keyof typeof ROLE_PERMISSIONS] || [];
        const parents = collectAncestors(r);
        const inherited = parents.flatMap(p => dynamicMap[p] || ROLE_PERMISSIONS[p as keyof typeof ROLE_PERMISSIONS] || []);
        return unionPermissions(base, inherited);
      })
    );

    // Expect user to inherit franchise_admin and tenant_admin permissions transitively via franchise_admin
    expect(resolved.includes('accounts.delete')).toBe(true); // from tenant_admin
    expect(resolved.includes('contacts.edit')).toBe(true);   // from franchise_admin
    expect(resolved.includes('leads.view')).toBe(true);      // base user
  });
});
