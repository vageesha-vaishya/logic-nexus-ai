import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAircraftTemplateRecordEligible, listAircraftTemplates } from './services';

const {
  mockGetSession,
  mockRefreshSession,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('aircraft template source validation', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'token-1' } } });
    mockRefreshSession.mockResolvedValue({ data: { session: { access_token: '' } } });
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('accepts valid aircraft template record with assembly model link', () => {
    expect(
      isAircraftTemplateRecordEligible({
        id: 'tpl-1',
        template_name: 'TEMP_A320-200',
        assembly_models: 'amodel-1',
        is_active: true,
      }),
    ).toBe(true);
  });

  it('rejects work-order style template names', () => {
    expect(
      isAircraftTemplateRecordEligible({
        id: 'tpl-2',
        template_name: 'WP-732-200 IF',
        assembly_models: 'amodel-2',
        is_active: true,
      }),
    ).toBe(false);
  });

  it('rejects records without assembly model linkage', () => {
    expect(
      isAircraftTemplateRecordEligible({
        id: 'tpl-3',
        template_name: 'TEMP_Unknown',
        assembly_models: '',
        is_active: true,
      }),
    ).toBe(false);
  });

  it('accepts model_json fallback linkage when assembly_models is empty', () => {
    expect(
      isAircraftTemplateRecordEligible({
        id: 'tpl-4',
        template_name: 'TEMP_A321',
        model_json: [{ assembly_model_id: 'amodel-4' }],
        is_active: true,
      }),
    ).toBe(true);
  });

  it('lists from aircraft_template endpoint only and filters invalid records', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          output: {
            records: [
              {
                id: 'tpl-valid',
                tenant_id: 'tenant-1',
                franchise_id: 'franchise-1',
                template_name: 'TEMP_A320',
                assembly_models: 'amodel-320',
                maintenance_program: 'MP-A320',
                revision_number: '1',
                amendment_number: '0',
                is_active: true,
              },
              {
                id: 'tpl-wp',
                tenant_id: 'tenant-1',
                franchise_id: 'franchise-1',
                template_name: 'WP-737-800 IF',
                assembly_models: 'amodel-737',
                is_active: true,
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const rows = await listAircraftTemplates({ tenantId: 'tenant-1', franchiseId: 'franchise-1', userId: 'user-1' });
    expect(rows).toHaveLength(1);
    expect(rows[0].template_name).toBe('TEMP_A320');

    const firstCallUrl = String(mockFetch.mock.calls[0]?.[0] || '');
    expect(firstCallUrl).toContain('/api/v2/amro/master-data/aircraft_template?');
    expect(firstCallUrl).not.toContain('work_order_templates');
  });
});
