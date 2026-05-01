import { describe, expect, it } from 'vitest';
import { buildPilotOptions, getPilotRoleIds, getPilotUserIds } from './pilot-users.helpers';

describe('pilot-users helpers', () => {
  it('extracts only active pilot custom roles within tenant scope', () => {
    const roleIds = getPilotRoleIds(
      [
        { id: 'role-pilot-t1', tenant_id: 'tenant-1', name: 'Pilot', is_active: true },
        { id: 'role-pilot-t1-inactive', tenant_id: 'tenant-1', name: 'Pilot', is_active: false },
        { id: 'role-copilot-t1', tenant_id: 'tenant-1', name: 'Co-pilot', is_active: true },
        { id: 'role-pilot-t2', tenant_id: 'tenant-2', name: 'Pilot', is_active: true },
      ],
      'tenant-1',
    );

    expect(roleIds).toEqual(['role-pilot-t1']);
  });

  it('filters pilot user assignments by tenant and pilot role ids', () => {
    const userIds = getPilotUserIds(
      [
        { user_id: 'user-1', role_id: 'role-pilot-t1', tenant_id: 'tenant-1' },
        { user_id: 'user-2', role_id: 'role-engineer-t1', tenant_id: 'tenant-1' },
        { user_id: 'user-3', role_id: 'role-pilot-t2', tenant_id: 'tenant-2' },
        { user_id: 'user-4', role_id: 'role-pilot-t1', tenant_id: 'tenant-1' },
        { user_id: 'user-4', role_id: 'role-pilot-t1', tenant_id: 'tenant-1' },
      ],
      ['role-pilot-t1'],
      'tenant-1',
    );

    expect(userIds).toEqual(['user-1', 'user-4']);
  });

  it('maps pilot profiles to display rows and excludes inactive/non-assigned users', () => {
    const options = buildPilotOptions(
      [
        { id: 'user-1', first_name: 'Arun', last_name: 'K', email: 'arun@example.com', is_active: true },
        { id: 'user-2', first_name: 'Lina', last_name: null, email: 'lina@example.com', is_active: false },
        { id: 'user-3', first_name: null, last_name: null, email: 'pilot3@example.com', is_active: true },
      ],
      ['user-3', 'user-1'],
    );

    expect(options).toEqual([
      { user_id: 'user-1', display_name: 'Arun K', email: 'arun@example.com' },
      { user_id: 'user-3', display_name: 'pilot3@example.com', email: 'pilot3@example.com' },
    ]);
  });
});
