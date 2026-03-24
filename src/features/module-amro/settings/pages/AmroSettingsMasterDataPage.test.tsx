import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AmroSettingsMasterDataPage, {
  AMRO_MASTER_ENTITY_FORM_FIELDS,
  buildPayloadFromForm,
  verifyReferenceExists,
} from './AmroSettingsMasterDataPage';

const mockGetSession = vi.fn();
const mockRefreshSession = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    context: {
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1',
      userId: 'user-1',
    },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

describe('AmroSettingsMasterDataPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-1',
        },
      },
    });
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: '',
        },
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (method === 'GET' && url.includes('/api/v2/amro/master-data/aircraft')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  records: [
                    {
                      id: 'ac-1',
                      registration: 'A1',
                      tail_number: 'N100AA',
                      serial_number: 'SN-100',
                      aircraft_type: 'A320',
                      aircraft_model: 'A320-200',
                      status: 'active',
                    },
                  ],
                },
              }),
          };
        }
        if (method === 'GET') {
          return {
            ok: true,
            text: async () => JSON.stringify({ output: { records: [] } }),
          };
        }
        if (method === 'POST' && url.includes('/api/v2/amro/master-data/aircraft')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  entity: 'aircraft',
                  record: { id: 'ac-2', tail_number: 'N200AA' },
                },
              }),
          };
        }
        if (method === 'PATCH') {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  entity: 'aircraft',
                  record: { id: 'ac-1', tail_number: 'N300AA' },
                },
              }),
          };
        }
        if (method === 'DELETE') {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  entity: 'aircraft',
                  deleted_id: 'ac-1',
                },
              }),
          };
        }
        if (method === 'POST') {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  imported_count: 1,
                  records: [{ id: 'template-1' }],
                },
              }),
          };
        }
        return {
          ok: true,
          text: async () => JSON.stringify({}),
        };
      }),
    );
  });

  it('renders a dedicated create-update form for each master data entity', async () => {
    render(
      <MemoryRouter>
        <AmroSettingsMasterDataPage />
      </MemoryRouter>,
    );

    const matrix = [
      { tab: 'Aircraft', entity: 'aircraft', labels: ['Tail Number', 'Aircraft Type'] },
      { tab: 'Parts Inventory', entity: 'parts_inventory', labels: ['Part Number', 'Min Stock Level'] },
      { tab: 'Suppliers', entity: 'suppliers', labels: ['Supplier Code', 'Lead Time (Days)'] },
      { tab: 'Maintenance Facilities', entity: 'maintenance_facilities', labels: ['Facility Code', 'Station Code'] },
      { tab: 'Work Centers', entity: 'work_centers', labels: ['Work Center Code', 'Center Type'] },
      { tab: 'Skill Codes', entity: 'skill_codes', labels: ['Skill Code', 'Skill Family'] },
      { tab: 'Regulator Profiles', entity: 'regulator_profiles', labels: ['Regulator Code', 'Policy Version'] },
      { tab: 'Shift Calendars', entity: 'shift_calendars', labels: ['Shift Start', 'Shift End'] },
      { tab: 'Work Package Templates', entity: 'work_package_templates', labels: ['Template Code', 'Maintenance Type'] },
    ];

    for (const entry of matrix) {
      expect(screen.getByRole('tab', { name: entry.tab })).toBeInTheDocument();
      const fields = AMRO_MASTER_ENTITY_FORM_FIELDS[entry.entity as keyof typeof AMRO_MASTER_ENTITY_FORM_FIELDS];
      const fieldLabels = fields.map((field) => field.label);
      for (const label of entry.labels) {
        expect(fieldLabels).toContain(label);
      }
    }

    expect(await screen.findByLabelText(/Tail Number/)).toBeInTheDocument();
  });

  it('submits create and update operations through dedicated forms', async () => {
    render(
      <MemoryRouter>
        <AmroSettingsMasterDataPage />
      </MemoryRouter>,
    );

    await screen.findByText('N100AA');

    fireEvent.change(screen.getByLabelText(/Tail Number/), { target: { value: 'N200AA' } });
    fireEvent.change(screen.getByLabelText(/Serial Number/), { target: { value: 'SN-200' } });
    fireEvent.change(screen.getByLabelText(/Aircraft Type/), { target: { value: 'A321' } });
    fireEvent.change(screen.getByLabelText(/Aircraft Model/), { target: { value: 'A321-200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Aircraft record created');
    });

    fireEvent.click(screen.getByText('N100AA'));
    fireEvent.change(screen.getByLabelText(/Tail Number/), { target: { value: 'N300AA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Selected' }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Aircraft record updated');
    });
  });

  it('confirms destructive operations and supports bulk import', async () => {
    render(
      <MemoryRouter>
        <AmroSettingsMasterDataPage />
      </MemoryRouter>,
    );

    await screen.findByText('N100AA');
    fireEvent.click(screen.getByText('N100AA'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));
    expect(await screen.findByText(/Delete selected Aircraft record/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Aircraft record deleted');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run Bulk Import' }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringMatching(/records imported$/));
    });
  });

  it('enforces required fields and rejects malformed date, time, and json values', () => {
    const requiredMatrix: Array<{ entity: keyof typeof AMRO_MASTER_ENTITY_FORM_FIELDS; field: string; message: string }> = [
      { entity: 'aircraft', field: 'tail_number', message: 'Tail Number is required' },
      { entity: 'parts_inventory', field: 'part_number', message: 'Part Number is required' },
      { entity: 'suppliers', field: 'supplier_code', message: 'Supplier Code is required' },
      { entity: 'maintenance_facilities', field: 'facility_code', message: 'Facility Code is required' },
      { entity: 'work_centers', field: 'work_center_code', message: 'Work Center Code is required' },
      { entity: 'skill_codes', field: 'skill_code', message: 'Skill Code is required' },
      { entity: 'regulator_profiles', field: 'regulator_code', message: 'Regulator Code is required' },
      { entity: 'shift_calendars', field: 'station_code', message: 'Station Code is required' },
      { entity: 'work_package_templates', field: 'template_code', message: 'Template Code is required' },
    ];

    requiredMatrix.forEach(({ entity, field, message }) => {
      const result = buildPayloadFromForm(entity, {});
      expect(result.errors[field]).toBe(message);
    });

    const supplierMalformed = buildPayloadFromForm('suppliers', {
      supplier_code: 'SUP-1',
      name: 'Supplier One',
      metadata: '{"invalid_json": }',
    });
    expect(supplierMalformed.errors.metadata).toBe('Metadata JSON must be valid JSON');

    const regulatorMalformedDate = buildPayloadFromForm('regulator_profiles', {
      regulator_code: 'FAA',
      regulator_name: 'Federal Aviation Administration',
      jurisdiction: 'US',
      policy_version: '2026.1',
      effective_from: '2026/01/01',
    });
    expect(regulatorMalformedDate.errors.effective_from).toBe('Effective From must be in YYYY-MM-DD format');

    const shiftMalformedTime = buildPayloadFromForm('shift_calendars', {
      station_code: 'DXB',
      shift_name: 'DAY',
      shift_start_time: 'bad',
      shift_end_time: '16:00',
    });
    expect(shiftMalformedTime.errors.shift_start_time).toBe('Shift Start must be in HH:mm or HH:mm:ss format');

    const shiftInvalidRange = buildPayloadFromForm('shift_calendars', {
      station_code: 'DXB',
      shift_name: 'DAY',
      shift_start_time: '18:00',
      shift_end_time: '10:00',
    });
    expect(shiftInvalidRange.errors.shift_end_time).toBe('Shift End must be after Shift Start');

    const templateMalformedJson = buildPayloadFromForm('work_package_templates', {
      template_code: 'TMP-1',
      template_name: 'Template',
      maintenance_type: 'line',
      version: 1,
      scope_json: '[{"phase":"inspection"}',
    });
    expect(templateMalformedJson.errors.scope_json).toBe('Scope JSON must be valid JSON');
  });

  it('fails referential checks when linked supplier or facility records are missing', async () => {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    await expect(verifyReferenceExists(headers, 'suppliers', 'SUP-MISSING', ['id', 'supplier_code'])).resolves.toBe(false);
    await expect(verifyReferenceExists(headers, 'maintenance_facilities', 'FAC-MISSING', ['id', 'facility_code'])).resolves.toBe(false);
  });
});
