import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lead } from '@/pages/dashboard/leads-data';
import {
  PipelineService,
  normalizeLeadMutationInput,
  validateLeadMutationInput,
} from './pipeline-service';

const baseLeadInput = {
  first_name: 'Jane',
  last_name: 'Doe',
  company: 'Acme Logistics',
  title: 'Procurement Manager',
  email: 'jane@example.com',
  phone: '+1 (555) 111-2222',
  status: 'new' as const,
  source: 'website',
  estimated_value: '12000',
  expected_close_date: '2026-05-10',
  description: 'Needs ocean freight quote',
  notes: 'High urgency',
  tenant_id: 'tenant-1',
  franchise_id: 'franchise-1',
  custom_fields: { priority: 'high' },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pipeline-service lead input validation', () => {
  it('normalizes contact fields and validates good payload', () => {
    const normalized = normalizeLeadMutationInput(baseLeadInput);
    const validation = validateLeadMutationInput(normalized);

    expect(normalized.email).toBe('jane@example.com');
    expect(normalized.phone).toBe('+15551112222');
    expect(normalized.estimated_value).toBe(12000);
    expect(validation).toEqual({ valid: true });
  });

  it('rejects missing contact methods', () => {
    const normalized = normalizeLeadMutationInput({
      ...baseLeadInput,
      email: '',
      phone: '',
    });
    const validation = validateLeadMutationInput(normalized);

    expect(validation.valid).toBe(false);
    if (validation.valid === false) {
      expect(validation.message).toContain('Provide at least one contact method');
    }
  });
});

describe('pipeline-service duplicate and concurrency safeguards', () => {
  it('returns duplicate error during create when matching lead exists', async () => {
    const scopedDb = {
      from: vi.fn(),
    } as any;

    vi.spyOn(PipelineService, 'findDuplicateLead').mockResolvedValue({
      id: 'lead-dup-1',
      first_name: 'Existing',
      last_name: 'Lead',
      email: 'jane@example.com',
      phone: '+15551112222',
      updated_at: '2026-03-10T10:00:00.000Z',
    });

    const result = await PipelineService.createLead(scopedDb, baseLeadInput);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.code).toBe('duplicate');
      expect(result.message).toContain('Potential duplicate found');
    }
    expect(scopedDb.from).not.toHaveBeenCalled();
  });

  it('returns conflict with current record during stale concurrent update', async () => {
    const currentLead = {
      id: 'lead-1',
      first_name: 'Jane',
      last_name: 'Doe',
      company: 'Acme Logistics',
      email: 'jane@example.com',
      phone: '+15551112222',
      status: 'qualified',
      source: 'website',
      estimated_value: 12000,
      created_at: '2026-03-01T00:00:00.000Z',
      lead_score: 72,
      qualification_status: 'high',
      owner_id: null,
      title: 'Procurement Manager',
      expected_close_date: '2026-05-10',
      description: 'Updated by another user',
      notes: 'Updated notes',
      updated_at: '2026-03-12T00:00:00.000Z',
      last_activity_date: null,
      converted_at: null,
      custom_fields: null,
      tenant_id: 'tenant-1',
      franchise_id: 'franchise-1',
    } satisfies Lead;

    const updateQuery = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const updateTable = {
      update: vi.fn().mockReturnValue(updateQuery),
    };

    const currentTable = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: currentLead }),
        }),
      }),
    };

    const scopedDb = {
      from: vi
        .fn()
        .mockImplementationOnce(() => updateTable)
        .mockImplementationOnce(() => currentTable),
    } as any;

    vi.spyOn(PipelineService, 'findDuplicateLead').mockResolvedValue(null);

    const result = await PipelineService.updateLead(scopedDb, {
      id: 'lead-1',
      input: baseLeadInput,
      expectedUpdatedAt: '2026-03-11T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.code).toBe('conflict');
      expect(result.message).toContain('updated by another user');
      expect(result.current?.id).toBe('lead-1');
    }
    expect(updateTable.update).toHaveBeenCalledTimes(1);
  });
});

describe('pipeline-service CRM API model handling', () => {
  it('uses CRM API when token and tenant context are present', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'lead-1',
            first_name: 'Jane',
            last_name: 'Doe',
            company: 'Acme Logistics',
            email: 'jane@example.com',
            phone: '+15551112222',
            status: 'new',
            source: 'website',
            estimated_value: 12000,
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
            tenant_id: 'tenant-1',
            franchise_id: null,
          },
        ],
        count: 1,
      }),
    } as any);

    const result = await PipelineService.listLeadsFromCrmApi(
      {
        accessToken: 'token-1',
        tenantId: 'tenant-1',
      },
      {}
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe('api');
      expect(result.totalCount).toBe(1);
      expect(result.data).toHaveLength(1);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestHeaders = requestInit.headers as Record<string, string>;
    expect(requestHeaders.Authorization).toBe('Bearer token-1');
    expect(requestHeaders['x-tenant-id']).toBe('tenant-1');
    expect(typeof requestHeaders['x-correlation-id']).toBe('string');
    expect(requestHeaders['x-correlation-id'].length).toBeGreaterThan(0);
  });

  it('accepts totalCount alias from CRM API payload', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        totalCount: 7,
      }),
    } as any);

    const result = await PipelineService.listLeadsFromCrmApi(
      {
        accessToken: 'token-1',
        tenantId: 'tenant-1',
      },
      {}
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe('api');
      expect(result.totalCount).toBe(7);
    }
  });

  it('returns missing token fallback reason when token is absent', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any);

    const result = await PipelineService.listLeadsFromCrmApi(
      {
        accessToken: null,
        tenantId: 'tenant-1',
      },
      {}
    );

    expect(result).toEqual({ ok: false, reason: 'missing_token', telemetry: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns forbidden scope fallback reason for 403 response', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 403,
      headers: {
        get: vi.fn().mockReturnValue(null),
      },
      json: async () => null,
    } as any);

    const result = await PipelineService.listLeadsFromCrmApi(
      {
        accessToken: 'token-1',
        tenantId: 'tenant-1',
      },
      {}
    );

    expect(result.ok).toBe(false);
    if (result.ok !== false) throw new Error('Expected fallback result');
    expect(result.reason).toBe('forbidden_scope');
    expect(result.telemetry?.httpStatus).toBe(403);
  });

  it('captures backend error code telemetry for API fallback', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 500,
      headers: {
        get: (name: string) => (name === 'x-request-id' ? 'req-123' : null),
      },
      json: async () => ({
        code: 'MISSING_ENV',
        statusCode: 500,
        error: 'Missing service environment configuration',
      }),
    } as any);

    const result = await PipelineService.listLeadsFromCrmApi(
      {
        accessToken: 'token-1',
        tenantId: 'tenant-1',
      },
      {}
    );

    expect(result.ok).toBe(false);
    if (result.ok !== false) throw new Error('Expected fallback result');
    expect(result.reason).toBe('api_5xx');
    expect(result.telemetry).toEqual({
      httpStatus: 500,
      backendCode: 'MISSING_ENV',
      backendStatusCode: 500,
      backendError: 'Missing service environment configuration',
      requestId: 'req-123',
    });
  });

  it('retries once on CRM API 5xx and returns API data when retry succeeds', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch' as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        json: async () => ({
          code: 'TEMPORARY_FAILURE',
          statusCode: 500,
          error: 'Temporary backend issue',
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [],
          count: 0,
        }),
      } as any);

    const result = await PipelineService.listLeadsFromCrmApi(
      {
        accessToken: 'token-1',
        tenantId: 'tenant-1',
      },
      {}
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe('api');
      expect(result.totalCount).toBe(0);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns unreachable fallback reason on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('Network failure'));

    const result = await PipelineService.listLeadsFromCrmApi(
      {
        accessToken: 'token-1',
        tenantId: 'tenant-1',
      },
      {}
    );

    expect(result).toEqual({ ok: false, reason: 'api_unreachable', telemetry: null });
  });

  it('propagates API fallback reason when listLeads falls back to scoped DB', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 401,
      headers: {
        get: vi.fn().mockReturnValue(null),
      },
      json: async () => ({
        code: 'MISSING_TOKEN',
        statusCode: 401,
        error: 'Missing or malformed Authorization header',
      }),
    } as any);

    const query = {
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: [],
          count: 0,
          error: null,
        }),
      }),
    };
    const scopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(query),
      }),
    } as any;

    const result = await PipelineService.listLeads(
      scopedDb,
      {},
      {
        accessToken: 'token-1',
        tenantId: 'tenant-1',
      }
    );

    expect(result.source).toBe('scopedDb');
    expect(result.fallbackReason).toBe('api_unauthorized');
    expect(result.fallbackTelemetry).toEqual({
      httpStatus: 401,
      backendCode: 'MISSING_TOKEN',
      backendStatusCode: 401,
      backendError: 'Missing or malformed Authorization header',
      requestId: null,
    });
  });
});

describe('pipeline-service opportunities fallback handling', () => {
  it('returns primary opportunities data with no fallback reason', async () => {
    const relationQuery = {
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: [{ id: 'opp-1', name: 'Opp A', stage: 'prospecting' }],
          count: 1,
          error: null,
        }),
      }),
    };

    const scopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(relationQuery),
      }),
    } as any;

    const result = await PipelineService.listOpportunities(scopedDb, {});
    expect(result.source).toBe('scopedDb');
    expect(result.fallbackReason).toBeNull();
    expect(result.totalCount).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('returns fallback reason when relations query fails and fallback succeeds', async () => {
    const relationQuery = {
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: null,
          count: null,
          error: new Error('relationship not found'),
        }),
      }),
    };
    const fallbackQuery = {
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: [{ id: 'opp-2', name: 'Opp B', stage: 'proposal' }],
          count: 1,
          error: null,
        }),
      }),
    };

    const scopedDb = {
      from: vi
        .fn()
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue(relationQuery),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue(fallbackQuery),
        }),
    } as any;

    const result = await PipelineService.listOpportunities(scopedDb, {});
    expect(result.source).toBe('scopedDb');
    expect(result.fallbackReason).toBe('relations_query_failed');
    expect(result.totalCount).toBe(1);
    expect(result.data).toHaveLength(1);
  });
});

describe('pipeline-service accounts contacts activities fallback handling', () => {
  it('returns fallback reason when account relations query fails and fallback succeeds', async () => {
    const relationQuery = {
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: null,
          count: null,
          error: new Error('relationship not found'),
        }),
      }),
    };
    const fallbackQuery = {
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: [{ id: 'acc-1', name: 'Acme' }],
          count: 1,
          error: null,
        }),
      }),
    };

    const scopedDb = {
      from: vi
        .fn()
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue(relationQuery) })
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue(fallbackQuery) }),
    } as any;

    const result = await PipelineService.listAccounts(scopedDb, {});
    expect(result.fallbackReason).toBe('relations_query_failed');
    expect(result.totalCount).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('returns fallback reason when contact relations query fails and fallback succeeds', async () => {
    const relationQuery = {
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: null,
          count: null,
          error: new Error('relationship not found'),
        }),
      }),
    };
    const fallbackQuery = {
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: [{ id: 'contact-1', first_name: 'Jane', last_name: 'Doe' }],
          count: 1,
          error: null,
        }),
      }),
    };

    const scopedDb = {
      from: vi
        .fn()
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue(relationQuery) })
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue(fallbackQuery) }),
    } as any;

    const result = await PipelineService.listContacts(scopedDb, {});
    expect(result.fallbackReason).toBe('relations_query_failed');
    expect(result.totalCount).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('returns fallback reason when activity relations query fails and fallback succeeds', async () => {
    const relationQuery = {
      ilike: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: null,
          count: null,
          error: new Error('relationship not found'),
        }),
      }),
    };
    const fallbackQuery = {
      ilike: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: [{ id: 'act-1', subject: 'Call follow-up' }],
          count: 1,
          error: null,
        }),
      }),
    };

    const scopedDb = {
      from: vi
        .fn()
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue(relationQuery) })
        .mockReturnValueOnce({ select: vi.fn().mockReturnValue(fallbackQuery) }),
    } as any;

    const result = await PipelineService.listActivities(scopedDb, {});
    expect(result.fallbackReason).toBe('relations_query_failed');
    expect(result.totalCount).toBe(1);
    expect(result.data).toHaveLength(1);
  });
});
