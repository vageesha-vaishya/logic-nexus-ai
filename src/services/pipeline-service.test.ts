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
