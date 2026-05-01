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

export function getPilotRoleIds(customRoles: CustomRoleRow[], tenantId: string): string[] {
  const normalizedTenantId = String(tenantId || '').trim();
  return customRoles
    .filter((row) => String(row.tenant_id || '').trim() === normalizedTenantId)
    .filter((row) => row.is_active !== false)
    .filter((row) => String(row.name || '').trim().toLowerCase() === 'pilot')
    .map((row) => String(row.id || '').trim())
    .filter((id) => Boolean(id));
}

export function getPilotUserIds(assignments: UserCustomRoleRow[], pilotRoleIds: string[], tenantId: string): string[] {
  if (!pilotRoleIds.length) {
    return [];
  }
  const roleIdSet = new Set(pilotRoleIds.map((id) => String(id || '').trim()));
  const normalizedTenantId = String(tenantId || '').trim();
  return Array.from(new Set(
    assignments
      .filter((row) => String(row.tenant_id || '').trim() === normalizedTenantId)
      .filter((row) => roleIdSet.has(String(row.role_id || '').trim()))
      .map((row) => String(row.user_id || '').trim())
      .filter((id) => Boolean(id)),
  ));
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
