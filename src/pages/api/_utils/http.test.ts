import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticateRequest, enforceAdminOverrideScope, enforceAmroDomainAccess, enforceDomainAccess, resolveAndApplyAccessContext, resolveUserAccessProfile, type UserAccessProfile } from './http';
import { getSupabaseAdminClient } from './supabaseAdmin';

vi.mock('./supabaseAdmin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

function buildAccess(overrides: Partial<UserAccessProfile> = {}): UserAccessProfile {
  return {
    userId: 'user-1',
    roles: ['user'],
    isPlatformAdmin: false,
    tenantId: 'tenant-1',
    franchiseId: null,
    adminOverrideEnabled: false,
    overrideTenantId: null,
    overrideFranchiseId: null,
    ...overrides,
  };
}

function createSelectEqChain(finalResult: any, eqCallsBeforeResolve = 1) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn(),
  };
  let remaining = eqCallsBeforeResolve;
  chain.eq.mockImplementation(() => {
    remaining -= 1;
    return remaining <= 0 ? Promise.resolve(finalResult) : chain;
  });
  return chain;
}

function createMaybeSingleChain(finalResult: any) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(finalResult),
  };
  return chain;
}

function createInsertChain(finalResult: any) {
  return {
    insert: vi.fn().mockResolvedValue(finalResult),
  };
}

function createMockRequest(headers: Record<string, string> = {}) {
  return {
    headers,
    method: 'GET',
    query: {},
  } as any;
}

describe('http domain and scope guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks non-platform users from crossing tenant scope', () => {
    const access = buildAccess();
    expect(() => enforceAdminOverrideScope(access, 'tenant-2', null)).toThrow('Forbidden');
  });

  it('blocks platform admins from crossing owned tenant scope', () => {
    const access = buildAccess({
      isPlatformAdmin: true,
      roles: ['platform_admin'],
      tenantId: 'tenant-1',
    });
    expect(() => enforceAdminOverrideScope(access, 'tenant-2', null)).toThrow('Forbidden');
  });

  it('blocks platform admins from global access when tenant scope is unresolved', () => {
    const access = buildAccess({
      isPlatformAdmin: true,
      roles: ['platform_admin'],
      tenantId: null,
      overrideTenantId: null,
    });
    expect(() => enforceAdminOverrideScope(access, null, null)).toThrow('Forbidden');
  });

  it('blocks non-platform users when tenant header is spoofed and user has no tenant', () => {
    const access = buildAccess({ tenantId: null });
    expect(() => enforceAdminOverrideScope(access, 'tenant-2', null)).toThrow('Forbidden');
  });

  it('applies resolved tenant scope to API context instead of trusting headers', async () => {
    const rolesQuery = createSelectEqChain(
      {
        data: [{ role: 'tenant_admin', tenant_id: 'tenant-owned', franchise_id: null }],
        error: null,
      },
      1
    );
    const preferenceQuery = createMaybeSingleChain({
      data: {
        tenant_id: 'tenant-spoofed',
        franchise_id: null,
        admin_override_enabled: false,
      },
      error: null,
    });

    const supabaseMock = {
      from: vi
        .fn()
        .mockReturnValueOnce(rolesQuery)
        .mockReturnValueOnce(preferenceQuery),
    } as any;

    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    const req = createMockRequest({ 'x-tenant-id': 'tenant-spoofed' });
    const ctx = {
      correlationId: 'corr-1',
      tenantId: '',
      franchiseId: '',
      userId: 'user-1',
      role: 'tenant_admin',
      isPlatformAdmin: false,
      adminOverrideEnabled: false,
    };

    await expect(resolveAndApplyAccessContext(req, ctx)).rejects.toThrow('Forbidden');
  });

  it('blocks platform admin franchise spoof when override is enabled', () => {
    const access = buildAccess({
      isPlatformAdmin: true,
      roles: ['platform_admin'],
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      adminOverrideEnabled: true,
      overrideTenantId: 'tenant-1',
      overrideFranchiseId: 'fr-1',
    });
    expect(() => enforceAdminOverrideScope(access, 'tenant-1', 'fr-2')).toThrow('Forbidden');
  });

  it('allows tenant admin override scope within tenant boundaries', () => {
    const access = buildAccess({
      roles: ['tenant_admin'],
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      adminOverrideEnabled: true,
      overrideTenantId: 'tenant-1',
      overrideFranchiseId: 'fr-1',
    });
    expect(() => enforceAdminOverrideScope(access, 'tenant-1', 'fr-1')).not.toThrow();
  });

  it('allows single-domain tenant access without explicit assignment', async () => {
    const tenantQuery = createSelectEqChain(
      {
        data: [{ platform_domains: { code: 'LOGISTICS' } }],
        error: null,
      },
      2
    );
    const supabaseMock = {
      from: vi.fn().mockReturnValue(tenantQuery),
    } as any;

    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    const result = await enforceDomainAccess(buildAccess(), 'LOGISTICS');
    expect(result.authorizedDomainCodes).toEqual(['LOGISTICS']);
    expect(result.tenantDomainCount).toBe(1);
  });

  it('falls back to tenant primary domain when assignment table is unavailable', async () => {
    const tenantAssignmentsQuery = createSelectEqChain(
      {
        data: null,
        error: { code: '42P01', message: 'relation "tenant_domain_assignments" does not exist' },
      },
      2
    );
    const tenantQuery = createMaybeSingleChain({
      data: { domain_id: 'domain-1' },
      error: null,
    });
    const platformDomainQuery = createMaybeSingleChain({
      data: { code: 'LOGISTICS' },
      error: null,
    });

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'tenant_domain_assignments') return tenantAssignmentsQuery;
        if (table === 'tenants') return tenantQuery;
        if (table === 'platform_domains') return platformDomainQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as any;

    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    const result = await enforceDomainAccess(buildAccess(), 'LOGISTICS');
    expect(result.authorizedDomainCodes).toEqual(['LOGISTICS']);
    expect(result.tenantDomainCount).toBe(1);
  });

  it('allows tenant-scoped platform admin through fallback domain resolution', async () => {
    const tenantAssignmentsQuery = createSelectEqChain(
      {
        data: null,
        error: { code: '42P01', message: 'relation "tenant_domain_assignments" does not exist' },
      },
      2
    );
    const tenantQuery = createMaybeSingleChain({
      data: { domain_id: 'domain-1' },
      error: null,
    });
    const platformDomainQuery = createMaybeSingleChain({
      data: { code: 'LOGISTICS' },
      error: null,
    });

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'tenant_domain_assignments') return tenantAssignmentsQuery;
        if (table === 'tenants') return tenantQuery;
        if (table === 'platform_domains') return platformDomainQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as any;

    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    const result = await enforceDomainAccess(
      buildAccess({
        isPlatformAdmin: true,
        roles: ['platform_admin'],
        tenantId: 'tenant-1',
      }),
      'LOGISTICS'
    );
    expect(result.authorizedDomainCodes).toEqual(['LOGISTICS']);
    expect(result.tenantDomainCount).toBe(1);
  });

  it('allows global platform admin override session without tenant assignment table', async () => {
    const platformDomainQuery = createSelectEqChain(
      {
        data: [
          { code: 'LOGISTICS' },
          { code: 'ECOMMERCE' },
        ],
        error: null,
      },
      1
    );

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'platform_domains') return platformDomainQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as any;

    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    const result = await enforceDomainAccess(
      buildAccess({
        isPlatformAdmin: true,
        roles: ['platform_admin'],
        tenantId: null,
        adminOverrideEnabled: true,
      }),
      'LOGISTICS'
    );
    expect(result.authorizedDomainCodes).toEqual(['LOGISTICS', 'ECOMMERCE']);
    expect(result.tenantDomainCount).toBe(2);
  });

  it('blocks unassigned domain in multi-domain tenant', async () => {
    const tenantQuery = createSelectEqChain(
      {
        data: [
          { platform_domains: { code: 'LOGISTICS' } },
          { platform_domains: { code: 'ECOMMERCE' } },
        ],
        error: null,
      },
      2
    );
    const userAssignmentQuery = createSelectEqChain(
      {
        data: [{ platform_domains: { code: 'LOGISTICS' } }],
        error: null,
      },
      3
    );

    const supabaseMock = {
      from: vi
        .fn()
        .mockReturnValueOnce(tenantQuery)
        .mockReturnValueOnce(userAssignmentQuery),
    } as any;

    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    await expect(enforceDomainAccess(buildAccess(), 'ECOMMERCE')).rejects.toThrow('Forbidden');
  });

  it('keeps platform admin scoped to owned tenant when override has null tenant preference', async () => {
    const rolesQuery = createSelectEqChain(
      {
        data: [
          { role: 'platform_admin', tenant_id: 'tenant-1', franchise_id: null },
          { role: 'tenant_admin', tenant_id: 'tenant-1', franchise_id: null },
        ],
        error: null,
      },
      1
    );
    const preferenceQuery = createMaybeSingleChain({
      data: {
        tenant_id: null,
        franchise_id: null,
        admin_override_enabled: true,
      },
      error: null,
    });

    const supabaseMock = {
      from: vi
        .fn()
        .mockReturnValueOnce(rolesQuery)
        .mockReturnValueOnce(preferenceQuery),
    } as any;

    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    const access = await resolveUserAccessProfile('user-1');
    expect(access.isPlatformAdmin).toBe(true);
    expect(access.adminOverrideEnabled).toBe(true);
    expect(access.overrideTenantId).toBeNull();
    expect(access.tenantId).toBe('tenant-1');
  });

  it('applies tenant admin franchise override from preferences', async () => {
    const rolesQuery = createSelectEqChain(
      {
        data: [{ role: 'tenant_admin', tenant_id: 'tenant-1', franchise_id: null }],
        error: null,
      },
      1
    );
    const preferenceQuery = createMaybeSingleChain({
      data: {
        tenant_id: 'tenant-1',
        franchise_id: 'fr-2',
        admin_override_enabled: true,
      },
      error: null,
    });

    const supabaseMock = {
      from: vi
        .fn()
        .mockReturnValueOnce(rolesQuery)
        .mockReturnValueOnce(preferenceQuery),
    } as any;

    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    const access = await resolveUserAccessProfile('user-1');
    expect(access.isPlatformAdmin).toBe(false);
    expect(access.tenantId).toBe('tenant-1');
    expect(access.franchiseId).toBe('fr-2');
    expect(access.adminOverrideEnabled).toBe(true);
  });

  it('revokes emergency-blocked user at authentication boundary', async () => {
    const supabaseMock = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'blocked-user',
              email: 'bahuguna.vimal001@gmail.com',
              app_metadata: { role: 'platform_admin', permissions: ['*'] },
            },
          },
          error: null,
        }),
      },
    } as any;

    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    await expect(
      authenticateRequest(
        createMockRequest({
          authorization: 'Bearer valid-token',
        })
      )
    ).rejects.toThrow('Unauthorized');
  });

  it('authorizes AMRO tenant assignment and writes audit trail', async () => {
    const assignmentQuery = createSelectEqChain(
      {
        data: [
          {
            id: 'tda-1',
            tenant_id: 'tenant-1',
            is_active: true,
            subscription_status: 'active',
            grace_until: null,
            platform_domains: { code: 'AMRO', is_active: true },
          },
        ],
        error: null,
      },
      2
    );
    const auditInsertQuery = createInsertChain({ error: null });

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'tenant_domain_assignments') return assignmentQuery;
        if (table === 'audit_logs') return auditInsertQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as any;

    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    const result = await enforceAmroDomainAccess(buildAccess(), { correlationId: 'corr-amro-1', bypassCache: true });
    expect(result.isAuthorized).toBe(true);
    expect(result.subscriptionStatus).toBe('active');
    expect(auditInsertQuery.insert).toHaveBeenCalledTimes(1);
  });

  it('blocks AMRO access when grace period is expired', async () => {
    const assignmentQuery = createSelectEqChain(
      {
        data: [
          {
            id: 'tda-2',
            tenant_id: 'tenant-1',
            is_active: true,
            subscription_status: 'grace_period',
            grace_until: '2020-01-01T00:00:00.000Z',
            platform_domains: { code: 'AMRO', is_active: true },
          },
        ],
        error: null,
      },
      2
    );
    const auditInsertQuery = createInsertChain({ error: null });

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'tenant_domain_assignments') return assignmentQuery;
        if (table === 'audit_logs') return auditInsertQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as any;
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    await expect(enforceAmroDomainAccess(buildAccess(), { bypassCache: true })).rejects.toThrow('Forbidden: AMRO grace period expired');
    expect(auditInsertQuery.insert).toHaveBeenCalledTimes(1);
  });

  it('uses AMRO cache result and still writes audit trail', async () => {
    const assignmentQuery = createSelectEqChain(
      {
        data: [
          {
            id: 'tda-3',
            tenant_id: 'tenant-1',
            is_active: true,
            subscription_status: 'active',
            grace_until: null,
            platform_domains: { code: 'AMRO', is_active: true },
          },
        ],
        error: null,
      },
      2
    );
    const auditInsertQuery = createInsertChain({ error: null });
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'tenant_domain_assignments') return assignmentQuery;
        if (table === 'audit_logs') return auditInsertQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as any;
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabaseMock);

    const first = await enforceAmroDomainAccess(buildAccess(), { correlationId: 'corr-amro-cache-1', bypassCache: true });
    const second = await enforceAmroDomainAccess(buildAccess(), { correlationId: 'corr-amro-cache-2' });

    expect(first.source).toBe('database');
    expect(second.source).toBe('cache');
    expect((assignmentQuery.eq as any).mock.calls.length).toBe(2);
    expect(auditInsertQuery.insert).toHaveBeenCalledTimes(2);
  });
});
