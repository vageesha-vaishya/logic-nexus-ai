
import { describe, it, expect } from 'vitest';
import { canManageRole, validateHierarchy, UserRole } from './RoleMatrix';

describe('RoleMatrix Security', () => {
  describe('canManageRole', () => {
    it('Platform Admin can manage all roles', () => {
      const roles: UserRole[] = ['platform_admin', 'tenant_admin', 'franchise_admin', 'user'];
      roles.forEach(role => {
        expect(canManageRole('platform_admin', role)).toBe(true);
      });
    });

    it('Tenant Admin can manage Franchise Admin and User', () => {
      expect(canManageRole('tenant_admin', 'franchise_admin')).toBe(true);
      expect(canManageRole('tenant_admin', 'user')).toBe(true);
    });

    it('Tenant Admin cannot manage Platform Admin or Tenant Admin', () => {
      expect(canManageRole('tenant_admin', 'platform_admin')).toBe(false);
      expect(canManageRole('tenant_admin', 'tenant_admin')).toBe(false);
    });

    it('Franchise Admin can only manage User', () => {
      expect(canManageRole('franchise_admin', 'user')).toBe(true);
      expect(canManageRole('franchise_admin', 'franchise_admin')).toBe(false);
      expect(canManageRole('franchise_admin', 'tenant_admin')).toBe(false);
      expect(canManageRole('franchise_admin', 'platform_admin')).toBe(false);
    });

    it('User cannot manage any roles', () => {
      const roles: UserRole[] = ['platform_admin', 'tenant_admin', 'franchise_admin', 'user'];
      roles.forEach(role => {
        expect(canManageRole('user', role)).toBe(false);
      });
    });
  });

  describe('validateHierarchy', () => {
    const tenantA = 'tenant-a';
    const tenantB = 'tenant-b';
    const franchiseA1 = 'franchise-a1';
    const franchiseA2 = 'franchise-a2';

    it('Platform Admin can do anything', () => {
      expect(validateHierarchy('platform_admin', null, null, tenantA, franchiseA1)).toBe(true);
    });

    it('Tenant Admin can manage within own tenant', () => {
      expect(validateHierarchy('tenant_admin', tenantA, null, tenantA, franchiseA1)).toBe(true);
      expect(validateHierarchy('tenant_admin', tenantA, null, tenantA, null)).toBe(true);
    });

    it('Tenant Admin cannot manage other tenants', () => {
      expect(validateHierarchy('tenant_admin', tenantA, null, tenantB, null)).toBe(false);
    });

    it('Franchise Admin can manage within own franchise', () => {
      expect(validateHierarchy('franchise_admin', tenantA, franchiseA1, tenantA, franchiseA1)).toBe(true);
    });

    it('Franchise Admin cannot manage other franchises in same tenant', () => {
      expect(validateHierarchy('franchise_admin', tenantA, franchiseA1, tenantA, franchiseA2)).toBe(false);
    });

    it('Franchise Admin cannot manage other tenants', () => {
      expect(validateHierarchy('franchise_admin', tenantA, franchiseA1, tenantB, franchiseA1)).toBe(false);
    });
  });
});
