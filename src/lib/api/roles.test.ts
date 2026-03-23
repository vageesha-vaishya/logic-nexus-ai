import { describe, expect, it, vi } from 'vitest';
import { RoleService } from './roles';

describe('RoleService.getRolePermissions', () => {
  it('falls back to legacy columns when scoped columns are unavailable', async () => {
    const select = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: '42703', message: 'column auth_role_permissions.scope_level does not exist' },
      })
      .mockResolvedValueOnce({
        data: [
          { role_id: 'tenant_admin', permission_id: 'view_dashboard' },
          { role_id: 'tenant_admin', permission_id: 'manage_users' },
        ],
        error: null,
      });

    const db = {
      client: {
        from: vi.fn().mockReturnValue({ select }),
      },
      accessContext: null,
    } as any;

    const service = new RoleService(db);
    const result = await service.getRolePermissions();

    expect(result).toEqual({
      tenant_admin: ['view_dashboard', 'manage_users'],
    });
    expect(select).toHaveBeenNthCalledWith(
      1,
      'role_id, permission_id, scope_level, tenant_id, franchise_id, is_denied',
    );
    expect(select).toHaveBeenNthCalledWith(2, 'role_id, permission_id');
  });

  it('applies denied permissions when scoped columns are available', async () => {
    const select = vi.fn().mockResolvedValue({
      data: [
        {
          role_id: 'tenant_admin',
          permission_id: 'view_dashboard',
          scope_level: 'global',
          is_denied: false,
        },
        {
          role_id: 'tenant_admin',
          permission_id: 'manage_users',
          scope_level: 'global',
          is_denied: true,
        },
      ],
      error: null,
    });

    const db = {
      client: {
        from: vi.fn().mockReturnValue({ select }),
      },
      accessContext: null,
    } as any;

    const service = new RoleService(db);
    const result = await service.getRolePermissions();

    expect(result).toEqual({
      tenant_admin: ['view_dashboard'],
    });
  });
});
