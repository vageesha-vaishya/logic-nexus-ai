type CustomRoleRow = {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean | null;
};

type UserCustomRoleRow = {
  user_id: string;
  role_id: string;
  tenant_id: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  is_active: boolean | null;
};

export type PilotOptionRow = {
  user_id: string;
  display_name: string;
  email: string;
};

export function getRoleIdsByName(customRoles: CustomRoleRow[], tenantId: string, roleName: string): string[] {
  const normalizedTenantId = String(tenantId || '').trim();
  const normalizedRoleName = String(roleName || '').trim().toLowerCase();
  return customRoles
    .filter((row) => String(row.tenant_id || '').trim() === normalizedTenantId)
    .filter((row) => row.is_active !== false)
    .filter((row) => String(row.name || '').trim().toLowerCase() === normalizedRoleName)
    .map((row) => String(row.id || '').trim())
    .filter((id) => Boolean(id));
}

export function getPilotRoleIds(customRoles: CustomRoleRow[], tenantId: string): string[] {
  return getRoleIdsByName(customRoles, tenantId, 'pilot');
}

export function getCoPilotRoleIds(customRoles: CustomRoleRow[], tenantId: string): string[] {
  return getRoleIdsByName(customRoles, tenantId, 'co-pilot');
}

export function getUserIdsByRoleIds(assignments: UserCustomRoleRow[], roleIds: string[], tenantId: string): string[] {
  if (!roleIds.length) {
    return [];
  }
  const roleIdSet = new Set(roleIds.map((id) => String(id || '').trim()));
  const normalizedTenantId = String(tenantId || '').trim();
  return Array.from(new Set(
    assignments
      .filter((row) => String(row.tenant_id || '').trim() === normalizedTenantId)
      .filter((row) => roleIdSet.has(String(row.role_id || '').trim()))
      .map((row) => String(row.user_id || '').trim())
      .filter((id) => Boolean(id)),
  ));
}

export function getPilotUserIds(assignments: UserCustomRoleRow[], pilotRoleIds: string[], tenantId: string): string[] {
  return getUserIdsByRoleIds(assignments, pilotRoleIds, tenantId);
}

export function getCoPilotUserIds(assignments: UserCustomRoleRow[], coPilotRoleIds: string[], tenantId: string): string[] {
  return getUserIdsByRoleIds(assignments, coPilotRoleIds, tenantId);
}

export function buildPilotOptions(profiles: ProfileRow[], pilotUserIds: string[]): PilotOptionRow[] {
  if (!pilotUserIds.length) {
    return [];
  }
  const userIdSet = new Set(pilotUserIds.map((id) => String(id || '').trim()));
  return profiles
    .filter((row) => row.is_active !== false)
    .filter((row) => userIdSet.has(String(row.id || '').trim()))
    .map((row) => {
      const firstName = String(row.first_name || '').trim();
      const lastName = String(row.last_name || '').trim();
      const fullName = `${firstName} ${lastName}`.trim();
      return {
        user_id: String(row.id || '').trim(),
        display_name: fullName || String(row.email || '').trim(),
        email: String(row.email || '').trim(),
      };
    })
    .filter((row) => Boolean(row.user_id) && Boolean(row.display_name))
    .sort((left, right) => left.display_name.localeCompare(right.display_name, undefined, { sensitivity: 'base' }));
}
