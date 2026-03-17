import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainAssignmentService } from './DomainAssignmentService';

describe('DomainAssignmentService', () => {
  const from = vi.fn();
  const supabase = { from } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns tenants and returns assignment summary', async () => {
    const selectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ tenant_id: 'tenant-2', is_active: false }],
        error: null,
      }),
    };
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });

    from.mockImplementation((table: string) => {
      if (table === 'domain_tenant') {
        return {
          ...selectQuery,
          upsert,
        };
      }
      if (table === 'domain_audit_log') {
        return { insert };
      }
      return {};
    });

    const service = new DomainAssignmentService(supabase);
    const result = await service.assignTenants({
      domainId: 'domain-1',
      tenantIds: ['tenant-1', 'tenant-2', 'tenant-3'],
      actorUserId: 'user-1',
      batchId: 'batch-1',
    });

    expect(result).toEqual({
      batchId: 'batch-1',
      domainId: 'domain-1',
      attempted: 3,
      assigned: 2,
      reactivated: 1,
      skipped: 0,
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('revokes active assignments and reports skipped entries', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ tenant_id: 'tenant-1', is_active: true }, { tenant_id: 'tenant-2', is_active: false }],
          error: null,
        })
        .mockResolvedValueOnce({ error: null }),
    };

    const insert = vi.fn().mockResolvedValue({ error: null });

    from.mockImplementation((table: string) => {
      if (table === 'domain_tenant') {
        return chain;
      }
      if (table === 'domain_audit_log') {
        return { insert };
      }
      return {};
    });

    const service = new DomainAssignmentService(supabase);
    const result = await service.revokeTenants({
      domainId: 'domain-1',
      tenantIds: ['tenant-1', 'tenant-2', 'tenant-3'],
      actorUserId: 'user-1',
      batchId: 'batch-2',
    });

    expect(result).toEqual({
      batchId: 'batch-2',
      domainId: 'domain-1',
      attempted: 3,
      revoked: 1,
      skipped: 2,
    });
    expect(chain.update).toHaveBeenCalledWith({ is_active: false });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('lists audit history with bounded limit', async () => {
    const rows = [{ id: 'a1', action: 'DOMAIN_ASSIGN' }];
    const query = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data: rows, error: null }),
    } as any;

    from.mockReturnValue(query);
    const service = new DomainAssignmentService(supabase);
    const result = await service.listAuditHistory({ tenantId: 'tenant-1', limit: 500 });

    expect(query.limit).toHaveBeenCalledWith(200);
    expect(query.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(result).toEqual(rows);
  });
});
