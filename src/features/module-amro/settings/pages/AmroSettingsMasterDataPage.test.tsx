import { cloneElement, isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AmroSettingsMasterDataPage, {
  AMRO_MASTER_ENTITY_FORM_FIELDS,
  buildPayloadFromForm,
  verifyReferenceExists,
} from './AmroSettingsMasterDataPage';
import { buildFlightLogPayload, getDefaultFlightLogFormValues, validateFlightLogFormValues } from './FlightLogForm';

const mockGetSession = vi.fn();
const mockRefreshSession = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockHasPermission = vi.fn((_permission: string) => true);
let mockAuthAccessToken = 'token-1';
const ASYNC_WAIT_TIMEOUT_MS = 4000;

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

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => mockHasPermission(permission),
    session: mockAuthAccessToken ? { access_token: mockAuthAccessToken } : null,
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

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
  })),
}));

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

vi.mock('@/components/ui/dropdown-menu', () => {
  const renderTrigger = (
    children: React.ReactNode,
    { asChild: _asChild, ...props }: Record<string, unknown> & { asChild?: boolean },
  ) => {
    if (isValidElement(children)) {
      return cloneElement(children as ReactElement, props);
    }
    return <button type="button" {...props}>{children}</button>;
  };
  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children, ...props }: { children: React.ReactNode }) => renderTrigger(children, props),
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div role="menu">{children}</div>,
    DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuItem: ({ children, onClick, onSelect }: { children: React.ReactNode; onClick?: () => void; onSelect?: () => void }) => (
      <button type="button" role="menuitem" onClick={() => { onSelect?.(); onClick?.(); }}>
        {children}
      </button>
    ),
    DropdownMenuCheckboxItem: (
      {
        children,
        checked,
        onCheckedChange,
        onSelect,
      }: { children: React.ReactNode; checked?: boolean; onCheckedChange?: (checked: boolean) => void; onSelect?: (event: { preventDefault: () => void }) => void },
    ) => (
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={checked ? 'true' : 'false'}
        onClick={() => {
          onSelect?.({ preventDefault: () => undefined });
          onCheckedChange?.(!checked);
        }}
      >
        {children}
      </button>
    ),
  };
});

vi.mock('@/components/ui/context-menu', () => {
  const renderTrigger = (
    children: React.ReactNode,
    { asChild: _asChild, ...props }: Record<string, unknown> & { asChild?: boolean },
  ) => {
    if (isValidElement(children)) {
      return cloneElement(children as ReactElement, props);
    }
    return <button type="button" {...props}>{children}</button>;
  };
  return {
    ContextMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ContextMenuTrigger: ({ children, ...props }: { children: React.ReactNode }) => renderTrigger(children, props),
    ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ContextMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ContextMenuSeparator: () => <hr />,
    ContextMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button type="button" onClick={onClick}>{children}</button>
    ),
  };
});

vi.mock('@/components/ui/tooltip', () => {
  const renderTrigger = (
    children: React.ReactNode,
    { asChild: _asChild, ...props }: Record<string, unknown> & { asChild?: boolean },
  ) => {
    if (isValidElement(children)) {
      return cloneElement(children as ReactElement, props);
    }
    return <span {...props}>{children}</span>;
  };
  return {
    TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children, ...props }: { children: React.ReactNode }) => renderTrigger(children, props),
    TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

describe('AmroSettingsMasterDataPage', { timeout: 12000 }, () => {
  const memoryRouterFuture = {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  } as const;

  const renderAircraftPage = () =>
    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/aircraft']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );
  const renderFlightLogsPage = () =>
    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/flight-logs']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );
  const renderWorkPackageTemplatesPage = () =>
    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/work-package-templates']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );
  const renderAircraftSubModulePage = (path = '/dashboard/amro/aircraft/list') =>
    render(
      <MemoryRouter initialEntries={[path]} future={memoryRouterFuture}>
        <Routes>
          <Route
            path="/dashboard/amro/aircraft/*"
            element={<AmroSettingsMasterDataPage entityOverride="aircraft" variant="aircraft-sub-module" />}
          />
        </Routes>
      </MemoryRouter>,
    );

  const openDropdownAndSelectItem = async (trigger: HTMLElement, itemName: RegExp) => {
    fireEvent.click(trigger);
    if (screen.queryAllByRole('menuitem', { name: itemName }).length === 0) {
      fireEvent.keyDown(trigger, { key: 'Enter' });
    }

    const rowScope = trigger.closest('tr');
    if (rowScope) {
      const scopedMenuItems = within(rowScope).queryAllByRole('menuitem', { name: itemName });
      if (scopedMenuItems.length > 0) {
        const scopedTarget = scopedMenuItems.find((item) => !item.hasAttribute('disabled')) ?? scopedMenuItems[0];
        fireEvent.click(scopedTarget);
        return;
      }
    }

    const menuItems = await screen.findAllByRole('menuitem', { name: itemName }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    const targetItem = menuItems.find((item) => !item.hasAttribute('disabled')) ?? menuItems[0];
    fireEvent.click(targetItem);
  };

  const resolveAuthorizationHeader = (headers: RequestInit['headers'] | undefined): string => {
    if (!headers) return '';
    if (headers instanceof Headers) {
      return String(headers.get('Authorization') || '');
    }
    if (Array.isArray(headers)) {
      const entry = headers.find(([key]) => String(key).toLowerCase() === 'authorization');
      return String(entry?.[1] || '');
    }
    return String((headers as Record<string, string>)['Authorization'] || (headers as Record<string, string>)['authorization'] || '');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockAuthAccessToken = 'token-1';
    mockHasPermission.mockImplementation(() => true);
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
                      manufacturer_id: 'manu-1',
                      manufacturer: 'Boeing',
                      owner_name: 'Owner One',
                      base_location: 'DEL',
                      defect_count: 2,
                      current_flight_hours: 5020.5,
                      current_cycles: 2201,
                      status: 'active',
                      first_limit_remaining: 120.5,
                      restrictions: 'Night ops only',
                    },
                    {
                      id: 'ac-2',
                      registration: 'A2',
                      tail_number: 'N200AA',
                      serial_number: 'SN-200',
                      aircraft_type: 'B737',
                      aircraft_model: 'B737-800',
                      manufacturer_id: 'manu-1',
                      manufacturer: 'Boeing',
                      owner_name: 'Owner Two',
                      base_location: 'BOM',
                      defect_count: 0,
                      current_flight_hours: 3010.25,
                      current_cycles: 1450,
                      status: 'inactive',
                      first_limit_remaining: 88,
                      restrictions: 'None',
                    },
                  ],
                },
              }),
          };
        }
        if (method === 'GET' && url.includes('/api/v2/amro/master-data/flight_logs')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  records: [
                    {
                      id: 'fl-1',
                      aircraft_id: 'ac-1',
                      aircraft_label: 'N100AA',
                      departure_airport_label: 'Indira Gandhi International (VIDP)',
                      arrival_airport_label: 'Netaji Subhas Chandra Bose (VECC)',
                      flight_date: '2026-03-25',
                      flight_number: 'FL-100',
                      pilot_name: 'Captain Rao',
                      departure_airport: 'DEL',
                      arrival_airport: 'CCU',
                      flight_hours: 2.2,
                      block_hours: 2.7,
                      flight_cycles: 1,
                      crew_details: 'Captain Rao / FO Sharma',
                      fuel_burn_kg: 1400,
                      pirep_discrepancy: 'None',
                    },
                  ],
                },
              }),
          };
        }
        if (method === 'GET' && url.includes('/api/v2/amro/master-data/manufacturers')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  records: [
                    {
                      id: 'manu-1',
                      manufacturer_code: 'BOE',
                      name: 'Boeing',
                      is_active: true,
                    },
                    {
                      id: 'manu-2',
                      manufacturer_code: 'AIR',
                      name: 'Airbus',
                      is_active: true,
                    },
                  ],
                },
              }),
          };
        }
        if (method === 'GET' && url.includes('/api/v2/amro/master-data/assembly_types')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  records: [
                    {
                      id: 'atype-1',
                      assembly_code: 'AIRFRAME',
                      name: 'Airframe',
                      is_active: true,
                    },
                  ],
                },
              }),
          };
        }
        if (method === 'GET' && url.includes('/api/v2/amro/master-data/assembly_models')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  records: [
                    {
                      id: 'amodel-1',
                      model_code: 'B737-800',
                      name: 'B737-800',
                      manufacturer_id: 'manu-1',
                      is_active: true,
                    },
                    {
                      id: 'amodel-2',
                      model_code: 'A320-200',
                      name: 'A320-200',
                      manufacturer_id: 'manu-2',
                      is_active: true,
                    },
                  ],
                },
              }),
          };
        }
        if (method === 'GET' && url.includes('/api/v2/amro/master-data/work_package_templates')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  records: [
                    {
                      id: 'wpt-1',
                      template_code: 'WP-LINE-001',
                      template_name: 'Line Check Package',
                      maintenance_type: 'line',
                      version: 1,
                      active: true,
                      created_at: '2026-03-20T12:00:00.000Z',
                      updated_at: '2026-03-25T12:00:00.000Z',
                      tenant_id: 'tenant-1',
                      franchise_id: 'franchise-1',
                      scope_json: '{"phase":"line"}',
                      tasks_json: '[{"task_number":"05-20","ata_code":"05-20","serial_number":"T34-AMS1","part_number":"PN-001","description":"Scheduled Maintenance Checks"}]',
                    },
                    {
                      id: 'wpt-2',
                      template_code: 'WP-BASE-002',
                      template_name: 'Base Check Package',
                      maintenance_type: 'base',
                      version: 2,
                      active: true,
                      created_at: '2026-03-21T12:00:00.000Z',
                      updated_at: '2026-03-26T12:00:00.000Z',
                      tenant_id: 'tenant-1',
                      franchise_id: 'franchise-1',
                      scope_json: '{"phase":"base"}',
                      tasks_json: '[{"task":"TASK-2"}]',
                    },
                  ],
                },
              }),
          };
        }
        if (method === 'GET' && url.includes('/api/v2/amro/aircraft-leads')) {
          const query = new URL(url, 'http://localhost');
          if (query.searchParams.get('autocomplete') === '1') {
            return {
              ok: true,
              text: async () =>
                JSON.stringify({
                  output: {
                    suggestions: ['Hydraulic Inspection', 'A320'],
                  },
                }),
            };
          }
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  records: [
                    {
                      id: 'lead-1',
                      aircraft_id: 'ac-1',
                      aircraft_registration: 'A1',
                      aircraft_type: 'A320',
                      title: 'Hydraulic Inspection',
                      description: 'Recurring hydraulic pressure variance',
                      status: 'new',
                      priority: 'high',
                      source: 'inspection',
                      score: 80,
                      assigned_to: 'Engineer Rao',
                      maintenance_due_at: '2026-04-03T00:00:00.000Z',
                      next_action_due_at: '2026-03-31T00:00:00.000Z',
                      compliance_state: 'review',
                      regulatory_authority: 'DGCA',
                      tags: ['hydraulic', 'phase-a'],
                      created_at: '2026-03-27T10:00:00.000Z',
                      updated_at: '2026-03-27T10:05:00.000Z',
                    },
                  ],
                  total_count: 1,
                },
              }),
          };
        }
        if (method === 'GET' && url.includes('/api/v2/amro/aircraft-dashboard')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  metadata: {
                    cache: 'miss',
                  },
                  kpis: {
                    open_work_packages: 4,
                    open_defects: 2,
                    total_flight_hours: 95.4,
                  },
                  maintenance_schedule: [
                    { title: 'Hydraulic manifold replacement', status: 'open', due_in_days: 4, compliance_state: 'pending' },
                  ],
                  defect_tracking: [
                    { title: 'N2 vibration exceedance', severity: 'high', status: 'open', due_in_days: 2 },
                  ],
                  performance_metrics: {
                    flight_hours_trend: [{ day: '2026-03-25', flight_hours: 6.2, cycles: 3 }],
                    defect_trend: [{ day: '2026-03-25', opened: 1, resolved: 0 }],
                  },
                  alerts: [
                    {
                      module: 'engine',
                      code: 'ENGINE_TBO_THRESHOLD',
                      severity: 'warning',
                      message: 'Engine TBO remaining 480h is within maintenance threshold',
                      due_in_days: 18,
                    },
                    {
                      module: 'components',
                      code: 'COMPONENT_AD_SB_PENDING',
                      severity: 'warning',
                      message: '2 AD/SB obligations remain pending',
                      due_in_days: 7,
                    },
                  ],
                  engine_module: {
                    kpis: {
                      monitored_engines: 2,
                      tbo_remaining_hours: 480,
                      llp_avg_remaining_cycles: 620,
                      oil_consumption_lph: 0.41,
                      vibration_ips: 0.62,
                    },
                    statuses: {
                      tbo: 'warning',
                      vibration: 'warning',
                    },
                    trend: [
                      { day: '2026-03-24', tbo_remaining_hours: 496, vibration_ips: 0.58, oil_consumption_lph: 0.37 },
                      { day: '2026-03-25', tbo_remaining_hours: 490, vibration_ips: 0.6, oil_consumption_lph: 0.39 },
                      { day: '2026-03-26', tbo_remaining_hours: 485, vibration_ips: 0.61, oil_consumption_lph: 0.4 },
                    ],
                    drilldown: {
                      defect_drivers: [{ title: 'N2 vibration exceedance', severity: 'high', due_in_days: 2 }],
                    },
                    serialized_engine_tracking: [
                      { engine_serial_number: 'ENG-1001', engine_position: 'L', installed_at: '2026-01-15T00:00:00.000Z' },
                    ],
                    thrust_rating_management: [
                      { engine_serial_number: 'ENG-1001', rated_thrust: 27500, derate_mode: 'CLB1', effective_from: '2026-02-01T00:00:00.000Z' },
                    ],
                    on_wing_lifecycle: [
                      { engine_serial_number: 'ENG-1001', event_type: 'on_wing_start', event_at: '2026-01-15T00:00:00.000Z', event_status: 'completed' },
                    ],
                  },
                  components_module: {
                    kpis: {
                      tracked_components: 28,
                      ad_sb_compliance_pct: 92,
                      ad_sb_pending_count: 2,
                      mtbur_hours: 78.4,
                      repeat_discrepancy_rate: 24.1,
                    },
                    statuses: {
                      ad_sb_compliance: 'warning',
                      reliability: 'warning',
                    },
                    trend: [
                      { day: '2026-03-24', replacements: 1, compliance_breaches: 0, defects_opened: 1 },
                      { day: '2026-03-25', replacements: 2, compliance_breaches: 1, defects_opened: 1 },
                    ],
                    lifecycle_tracking: [
                      { title: 'Fuel pump unit', compliance_state: 'pending', due_in_days: 6 },
                    ],
                    replacement_history: [
                      { title: 'Valve assembly replacement', status: 'open', reported_at: '2026-03-25T00:00:00.000Z' },
                    ],
                    drilldown: {
                      open_defects: [{ title: 'Fuel pump leak', severity: 'medium', status: 'open' }],
                    },
                  },
                },
              }),
          };
        }
        if (method === 'GET') {
          if (url.includes('/api/v2/amro/work-packages')) {
            return {
              ok: true,
              text: async () =>
                JSON.stringify({
                  items: [
                    { id: 'wp-1', status: 'planning', priority: 'high' },
                    { id: 'wp-2', status: 'execution', priority: 'critical' },
                    { id: 'wp-3', status: 'deferred', priority: 'medium' },
                  ],
                }),
            };
          }
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
        if (method === 'PUT' && url.includes('/api/v2/amro/master-data/aircraft/')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  entity: 'aircraft',
                  record: { id: 'ac-1', tail_number: 'N100AB' },
                },
              }),
          };
        }
        if (method === 'POST' && url.includes('/api/v2/amro/flight-logs')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  flight_log: {
                    flight_log_id: 'fl-1',
                    maintenance_flags: [],
                  },
                },
              }),
          };
        }
        if (method === 'POST' && url.includes('/api/v2/amro/aircraft-leads')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  record: {
                    id: 'lead-new',
                  },
                  updated_count: 1,
                  deleted_count: 1,
                },
              }),
          };
        }
        if (method === 'PUT' && url.includes('/api/v2/amro/aircraft-leads')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  record: {
                    id: 'lead-1',
                    title: 'Hydraulic Inspection Updated',
                  },
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

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders all ten master data modules with shared list layout controls', async () => {
    renderAircraftPage();

    const matrix = [
      { tab: 'Aircraft', entity: 'aircraft', labels: ['Tail Number', 'Aircraft Type'] },
      { tab: 'Parts Inventory', entity: 'parts_inventory', labels: ['Part Number', 'Min Stock Level'] },
      { tab: 'Suppliers', entity: 'suppliers', labels: ['Supplier Code', 'Lead Time (Days)'] },
      { tab: 'Maintenance Facilities', entity: 'maintenance_facilities', labels: ['Facility Code', 'Station Code'] },
      { tab: 'Work Centers', entity: 'work_centers', labels: ['Work Center Code', 'Center Type'] },
      { tab: 'Skill Codes', entity: 'skill_codes', labels: ['Skill Code', 'Skill Family'] },
      { tab: 'Manufacturers', entity: 'manufacturers', labels: ['Manufacturer Code', 'Name'] },
      { tab: 'Model', entity: 'assembly_models', labels: ['Model Code', 'Name'] },
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

    expect(await screen.findByLabelText(/Refresh records/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Bulk Import/ })).toBeInTheDocument();
  });

  it('renders aircraft sub-module as standalone AMRO surface without entity tabs', async () => {
    renderAircraftSubModulePage();

    expect(await screen.findByRole('heading', { name: 'AMRO · Aircraft' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'AMRO Overview' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tenant-scoped aircraft operations management with governed CRUD controls, validation, filtering, and exports.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Tenant:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Refresh records/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Bulk Import/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Parts Inventory' })).not.toBeInTheDocument();
  });

  it('applies the standardized five-column master data design system classes in form dialog layout', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/parts-inventory']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const newPartsInventoryButton = await screen.findByRole(
      'button',
      { name: /New\s+Parts Inventory/i },
      { timeout: ASYNC_WAIT_TIMEOUT_MS },
    );
    const template = await screen.findByTestId('amro-master-data-template', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    expect(template).toHaveClass('mdm-template-page');

    fireEvent.click(newPartsInventoryButton);
    const dialog = await screen.findByTestId('amro-master-data-form-dialog', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    expect(dialog).toHaveClass('mdm-template-dialog');

    const basicGrid = await screen.findByTestId('amro-master-data-basic-grid', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    expect(basicGrid).toHaveClass('mdm-template-form-grid');
  });

  it('submits create and update operations through modal CRUD forms', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/parts-inventory']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: /New Parts Inventory/ }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    fireEvent.click(screen.getByRole('button', { name: /New Parts Inventory/ }));
    const dialog = await screen.findByTestId('amro-master-data-form-dialog', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    fireEvent.change(within(dialog).getByLabelText(/^Part Number/i), { target: { value: 'PART-200' } });
    fireEvent.click(within(dialog).getByRole('tab', { name: /Configuration Settings/i }));
    fireEvent.change(within(dialog).getByLabelText(/^Warehouse Location/i), { target: { value: 'DXB-A1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Parts Inventory record created');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    expect(mockToastSuccess).toHaveBeenCalledWith('Parts Inventory record created');
  });

  it('renders manufacturer and assembly type dropdown options for model creation', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/model']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const newModelButton = await screen.findByRole('button', { name: /New Model/ }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    fireEvent.click(newModelButton);

    const dialog = await screen.findByTestId('amro-master-data-form-dialog', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    fireEvent.click(within(dialog).getByLabelText(/^Manufacturer/i));
    expect(await screen.findByRole('option', { name: 'Boeing (BOE)' }, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByLabelText(/^Assembly Type/i));
    expect(await screen.findByRole('option', { name: 'Airframe (AIRFRAME)' }, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
  });

  it('hydrates entity state from kebab-case route segments', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/parts-inventory']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New\s+Parts Inventory/ })).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('supports bulk import from aircraft baseline controls', async () => {
    renderAircraftPage();

    await screen.findByRole('button', { name: /Run Bulk Import/ });

    fireEvent.click(screen.getByText('Run Bulk Import'));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringMatching(/records imported$/));
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('supports aircraft baseline work package creation actions from dashboard card', async () => {
    renderAircraftPage();

    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    expect(await screen.findByText('Add work package')).toBeInTheDocument();
    const workPackageDialog = await screen.findByTestId('amro-aircraft-work-package-dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Please resolve aircraft work package validation errors');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    expect(await within(workPackageDialog).findByLabelText('Template registry')).toBeInTheDocument();
    fireEvent.click(within(workPackageDialog).getByLabelText('Template registry'));
    fireEvent.click(await screen.findByRole('option', { name: 'WP-LINE-001' }));

    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '145' } });
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Hydraulic inspection campaign' } });
    fireEvent.change(screen.getByLabelText('Revision'), { target: { value: 'R2' } });
    fireEvent.change(screen.getByLabelText('TTAF'), { target: { value: '120.5' } });

    fireEvent.click(screen.getByLabelText('Status'));
    fireEvent.click(await screen.findByRole('option', { name: 'Planning' }));

    fireEvent.click(screen.getByLabelText('Validation'));
    fireEvent.click(await screen.findByRole('option', { name: 'Pending' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all tasks in page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Aircraft work package created');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    const createWorkPackageCall = vi
      .mocked(fetch)
      .mock.calls.find(([input, init]) =>
        String(input).includes('/api/v2/amro/work-packages?interface=create-work-package')
        && String(init?.method || 'GET').toUpperCase() === 'POST');
    expect(createWorkPackageCall).toBeDefined();
    const createPayload = JSON.parse(String(createWorkPackageCall?.[1]?.body || '{}')) as Record<string, unknown>;
    expect(createPayload.trigger_source).toBe('schedule_due');
    expect(createPayload.trigger_reference_id).toBe('ac-1');
  });

  it('renders aircraft-only operations overview in aircraft operations snapshot without engine/components module leakage', async () => {
    renderAircraftPage();

    await screen.findByText('Aircraft Operations Snapshot');
    expect(await screen.findByText('Aircraft Operations Overview')).toBeInTheDocument();
    expect(screen.getByText('Maintenance Schedule')).toBeInTheDocument();
    expect(screen.getByText('Defect Tracking')).toBeInTheDocument();
    expect(screen.queryByText('Engine Monitoring')).not.toBeInTheDocument();
    expect(screen.queryByText('Engine & Components Monitoring')).not.toBeInTheDocument();
    expect(screen.queryByText('Components Monitoring')).not.toBeInTheDocument();
  });

  it('routes each aircraft sub-module to its dedicated interface without cross-module content leakage', async () => {
    renderAircraftSubModulePage('/dashboard/amro/aircraft/list');
    expect(await screen.findByText(/Aircraft Search and Filter/i, {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Engine' }));
    expect(await screen.findByText(/View: engine/i, {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(screen.getByText(/TBO Remaining:/i)).toBeInTheDocument();
    expect(screen.getByText(/Engine Lifecycle Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Maintenance Scheduling & Tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/Work Order Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Compliance Tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/Performance Analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/Integration Capabilities/i)).toBeInTheDocument();
    expect(screen.getByText(/Serialized Engine Tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/Thrust Rating Change Log/i)).toBeInTheDocument();
    expect(screen.getByText(/On-Wing Lifecycle Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/ENG-1001 · L · installed 2026-01-15/i)).toBeInTheDocument();
    expect(screen.queryByText(/Components Monitoring/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Components' }));
    expect(await screen.findByText(/View: components/i, {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(screen.getByText(/AD\/SB Compliance:/i)).toBeInTheDocument();
    expect(screen.queryByText(/Document Repository/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Documents' }));
    expect(await screen.findByText(/Documents Management/i, {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(screen.getByText(/Document Repository/i)).toBeInTheDocument();
    expect(screen.queryByText(/Engine Drill-down/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'AD/SB' }));
    expect(await screen.findByText(/AD\/SB Management/i, {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(screen.getByText(/AD\/SB Compliance Management/i)).toBeInTheDocument();
    expect(screen.queryByText(/Document Repository/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aircraft List' }));
    expect(await screen.findByText(/Aircraft Search and Filter/i)).toBeInTheDocument();
  });

  it('renders aircraft navigation view buttons without duplicates and supports search-oriented list behavior', async () => {
    renderAircraftPage();

    await screen.findByText('Aircraft Operations Snapshot');

    expect(screen.getAllByRole('button', { name: 'Pipeline' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'List' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Grid' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Card' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Analytics' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Import/Export' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pipeline' }));
    expect(await screen.findByText('Aircraft Leads Workspace')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    await waitFor(() => {
      expect(screen.queryByText('Aircraft Leads Workspace')).not.toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('adds a New action in aircraft header navigation and opens create modal', async () => {
    renderAircraftPage();

    const newButton = await screen.findByRole('button', { name: /New aircraft record/i });
    fireEvent.click(newButton);

    expect(await screen.findByRole('heading', { name: 'Create Aircraft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('allows selecting aircraft fields and persists selected columns', async () => {
    const firstRender = renderAircraftPage();

    await screen.findByText('N100AA');
    expect(await screen.findByRole('columnheader', { name: /Owner/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Select aircraft fields/i }));
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Owner' }));

    await waitFor(() => {
      expect(screen.queryByRole('columnheader', { name: /Owner/i })).not.toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    const storageKey = 'amro:aircraft-visible-columns:tenant-1:franchise-1';
    const storedValue = localStorage.getItem(storageKey);
    expect(storedValue).not.toBeNull();
    expect(storedValue).not.toContain('owner_name');

    firstRender.unmount();
    renderAircraftPage();
    await screen.findByText('N100AA');
    await waitFor(() => {
      expect(screen.queryByRole('columnheader', { name: /Owner/i })).not.toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('supports aircraft column filtering and row selection controls', async () => {
    renderAircraftPage();

    await screen.findByText('N100AA');
    expect(screen.queryByRole('link', { name: /A1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /N100AA/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^ID$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Created At$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Updated At$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Tenant Id$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Franchise Id$/i })).not.toBeInTheDocument();

    const rowCheckboxes = screen.getAllByRole('checkbox', { name: /Select row/ });
    fireEvent.click(rowCheckboxes[0]);
    expect(screen.getByText(/Checked: 1/)).toBeInTheDocument();
  });

  it('opens aircraft update form on row double click', async () => {
    renderAircraftPage();

    const rowCheckbox = await screen.findByRole('checkbox', { name: 'Select row ac-1' });
    const aircraftRow = rowCheckbox.closest('tr');
    expect(aircraftRow).not.toBeNull();
    fireEvent.doubleClick(aircraftRow as HTMLElement);
    expect(await screen.findByRole('heading', { name: 'Update Aircraft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('includes existing base and owner values in aircraft listbox options', async () => {
    renderAircraftPage();

    const rowCheckbox = await screen.findByRole('checkbox', { name: 'Select row ac-1' });
    const aircraftRow = rowCheckbox.closest('tr');
    expect(aircraftRow).not.toBeNull();
    fireEvent.doubleClick(aircraftRow as HTMLElement);
    expect(await screen.findByRole('heading', { name: 'Update Aircraft' })).toBeInTheDocument();

    const formDialog = screen.getByTestId('amro-master-data-form-dialog');
    const baseLabel = within(formDialog).getByText(/^Base$/);
    const baseTrigger = (baseLabel.parentElement as HTMLElement).querySelector('button[role="combobox"]');
    expect(baseTrigger).not.toBeNull();
    fireEvent.click(baseTrigger as HTMLElement);
    expect(await screen.findByRole('option', { name: 'DEL' })).toBeInTheDocument();

    const ownerLabel = within(formDialog).getByText(/^Owner$/);
    const ownerTrigger = (ownerLabel.parentElement as HTMLElement).querySelector('button[role="combobox"]');
    expect(ownerTrigger).not.toBeNull();
    fireEvent.click(ownerTrigger as HTMLElement);
    expect(await screen.findByRole('option', { name: 'Owner One' })).toBeInTheDocument();
  });

  it('filters aircraft model listbox options by selected manufacturer in aircraft create form', async () => {
    renderAircraftPage();

    fireEvent.click(await screen.findByRole('button', { name: /New aircraft record/i }));
    const dialog = await screen.findByTestId('amro-master-data-form-dialog');

    const manufacturerTrigger = within(dialog).getByText('Manufacturer').closest('button');
    expect(manufacturerTrigger).not.toBeNull();
    fireEvent.click(manufacturerTrigger as HTMLElement);
    fireEvent.click(await screen.findByRole('option', { name: 'Airbus (AIR)' }));

    const modelTrigger = within(dialog).getByText('Aircraft model').closest('button');
    expect(modelTrigger).not.toBeNull();
    fireEvent.click(modelTrigger as HTMLElement);
    expect(await screen.findByRole('option', { name: 'A320-200' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'B737-800' })).not.toBeInTheDocument();
  });

  it('creates aircraft with manufacturer-model selection and preserves those values when reopened', async () => {
    const fetchImplementation = vi.mocked(fetch).getMockImplementation();
    const aircraftRecords: Array<Record<string, unknown>> = [
      {
        id: 'ac-1',
        registration: 'A1',
        tail_number: 'N100AA',
        serial_number: 'SN-100',
        aircraft_type: 'A320',
        aircraft_model: 'A320-200',
        manufacturer_id: 'manu-1',
        manufacturer: 'Boeing',
        owner_name: 'Owner One',
        base_location: 'DEL',
        defect_count: 2,
        current_flight_hours: 5020.5,
        current_cycles: 2201,
        status: 'active',
      },
      {
        id: 'ac-2',
        registration: 'A2',
        tail_number: 'N200AA',
        serial_number: 'SN-200',
        aircraft_type: 'B737',
        aircraft_model: 'B737-800',
        manufacturer_id: 'manu-1',
        manufacturer: 'Boeing',
        owner_name: 'Owner Two',
        base_location: 'BOM',
        defect_count: 0,
        current_flight_hours: 3010.25,
        current_cycles: 1450,
        status: 'inactive',
      },
    ];
    let createdPayload: Record<string, unknown> | null = null;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      if (method === 'GET' && url.includes('/api/v2/amro/master-data/aircraft')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              output: {
                records: aircraftRecords,
              },
            }),
        } as Response;
      }
      if (method === 'POST' && url.includes('/api/v2/amro/master-data/aircraft')) {
        createdPayload = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        const manufacturerId = String(createdPayload.manufacturer_id || '');
        const registration = String(createdPayload.registration || '').trim().toUpperCase();
        const serialNumber = String(createdPayload.serial_number || '').trim().toUpperCase();
        const aircraftModel = String(createdPayload.aircraft_model || '').trim();
        const status = String(createdPayload.status || 'active').trim().toLowerCase() || 'active';
        const createdRecord = {
          id: 'ac-3',
          registration,
          tail_number: registration,
          serial_number: serialNumber,
          aircraft_type: String(createdPayload.aircraft_type || 'NarrowBody'),
          aircraft_model: aircraftModel,
          manufacturer_id: manufacturerId,
          manufacturer: manufacturerId === 'manu-2' ? 'Airbus' : 'Boeing',
          owner_name: '',
          base_location: '',
          defect_count: 0,
          current_flight_hours: 0,
          current_cycles: 0,
          status,
        };
        aircraftRecords.unshift(createdRecord);
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              output: {
                entity: 'aircraft',
                record: createdRecord,
              },
            }),
        } as Response;
      }
      return fetchImplementation ? fetchImplementation(input, init) : Promise.reject(new Error('Missing fetch mock implementation'));
    });

    renderAircraftPage();
    fireEvent.click(await screen.findByRole('button', { name: /New aircraft record/i }));
    const createDialog = await screen.findByTestId('amro-master-data-form-dialog');

    fireEvent.change(within(createDialog).getByLabelText(/^Registration/i), { target: { value: 'N300AA' } });
    fireEvent.change(within(createDialog).getByLabelText(/^Serial number/i), { target: { value: 'SN-300' } });

    const manufacturerTrigger = within(createDialog).getByText('Manufacturer').closest('button');
    expect(manufacturerTrigger).not.toBeNull();
    fireEvent.click(manufacturerTrigger as HTMLElement);
    fireEvent.click(await screen.findByRole('option', { name: 'Airbus (AIR)' }));

    const modelTrigger = within(createDialog).getByText('Aircraft model').closest('button');
    expect(modelTrigger).not.toBeNull();
    fireEvent.click(modelTrigger as HTMLElement);
    fireEvent.click(await screen.findByRole('option', { name: 'A320-200' }));

    fireEvent.click(within(createDialog).getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Aircraft record created');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    expect(createdPayload?.manufacturer_id).toBe('manu-2');
    expect(createdPayload?.aircraft_model).toBe('A320-200');

    expect(mockToastSuccess).toHaveBeenCalledWith('Aircraft record created');
  });

  it('shows manufacturer listbox fallback option when manufacturer master data request fails', async () => {
    const fetchImplementation = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      if (method === 'GET' && url.includes('/api/v2/amro/master-data/manufacturers')) {
        return {
          ok: false,
          status: 500,
          text: async () => JSON.stringify({ message: 'error' }),
        } as Response;
      }
      return fetchImplementation ? fetchImplementation(input, init) : Promise.reject(new Error('Missing fetch mock implementation'));
    });

    renderAircraftPage();
    fireEvent.click(await screen.findByRole('button', { name: /New aircraft record/i }));
    const dialog = await screen.findByTestId('amro-master-data-form-dialog');

    const manufacturerTrigger = within(dialog).getByText('Manufacturer').closest('button');
    expect(manufacturerTrigger).not.toBeNull();
    fireEvent.click(manufacturerTrigger as HTMLElement);
    expect(await screen.findByRole('option', { name: 'Unable to load manufacturers' })).toBeInTheDocument();
  });

  it('hides configured work package columns while preserving filter and export actions', async () => {
    renderWorkPackageTemplatesPage();

    await screen.findByText('WP-LINE-001');
    expect(screen.queryByRole('columnheader', { name: /^ID$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Created At$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Updated At$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Tenant Id$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Franchise Id$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Scope Json$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Selection Summary:/)).toBeInTheDocument();

    expect(screen.getByText('WP-BASE-002')).toBeInTheDocument();

    const exportButtons = screen.getAllByLabelText(/Export records/i);
    expect(exportButtons.length).toBeGreaterThan(0);
    fireEvent.click(exportButtons[0]);
  });

  it('opens work package update form on row double click with prepopulated data and CRUD controls', async () => {
    renderWorkPackageTemplatesPage();

    const table = await screen.findByRole('table');
    const dataRows = within(table).getAllByRole('row').filter((row) => row.querySelector('td'));
    expect(dataRows.length).toBeGreaterThan(0);

    fireEvent.doubleClick(dataRows[0]);
    expect(await screen.findByRole('heading', { name: 'Update Work Package Templates' })).toBeInTheDocument();
    expect(screen.getByText('Work Package Details')).toBeInTheDocument();
    expect(screen.getByText('Selected Tasks')).toBeInTheDocument();
    expect(screen.getByText('Scope Definition')).toBeInTheDocument();
    expect(screen.getAllByText('Tasks JSON').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Template Code')).toHaveValue('WP-LINE-001');
    expect(screen.getByLabelText('Template Name')).toHaveValue('Line Check Package');
    expect(screen.getAllByText('05-20').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Scheduled Maintenance Checks').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('shows navigation error toast when double-clicked work package row has no record id', async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation();
    if (!baseFetch) {
      throw new Error('Missing fetch mock implementation');
    }
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      if (method === 'GET' && url.includes('/api/v2/amro/master-data/work_package_templates')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              output: {
                records: [
                  {
                    id: '',
                    template_code: 'WP-NO-ID',
                    template_name: 'Missing Id Package',
                    maintenance_type: 'line',
                    version: 1,
                    active: true,
                    tasks_json: '[]',
                  },
                ],
              },
            }),
        } as any;
      }
      return baseFetch(input, init);
    });

    renderWorkPackageTemplatesPage();
    const table = await screen.findByRole('table');
    const dataRows = within(table).getAllByRole('row').filter((row) => row.querySelector('td'));
    fireEvent.doubleClick(dataRows[0]);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Unable to open form for this record');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('keeps work package list behavior consistent across permission profiles', async () => {
    const permissionProfiles = [
      { name: 'admin', hasPermission: () => true },
      { name: 'viewer', hasPermission: () => false },
    ];

    for (const profile of permissionProfiles) {
      mockHasPermission.mockImplementation(profile.hasPermission);
      const view = renderWorkPackageTemplatesPage();
      await screen.findByText('WP-LINE-001');
      expect(screen.queryByRole('columnheader', { name: /^ID$/i })).not.toBeInTheDocument();
      const table = await screen.findByRole('table');
      const dataRows = within(table).getAllByRole('row').filter((row) => row.querySelector('td'));
      fireEvent.doubleClick(dataRows[0]);
      expect(await screen.findByRole('heading', { name: 'Update Work Package Templates' })).toBeInTheDocument();
      view.unmount();
    }
  });

  it('includes Bearer Authorization header on aircraft row-triggered work package snapshot requests', async () => {
    renderAircraftPage();

    await screen.findByText('N100AA');
    await waitFor(() => {
      const snapshotCalls = vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).includes('/api/v2/amro/work-packages'));
      expect(snapshotCalls.length).toBeGreaterThan(0);
      const hasBearerHeader = snapshotCalls.some(([, init]) => resolveAuthorizationHeader(init?.headers).startsWith('Bearer token-1'));
      expect(hasBearerHeader).toBe(true);
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('shows session-expired message and skips snapshot request when no auth token exists', async () => {
    mockAuthAccessToken = '';
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockRefreshSession.mockResolvedValue({ data: { session: null } });

    renderAircraftPage();

    await screen.findByText('N100AA');
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Your session has expired. Sign in again to load aircraft details.');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    const snapshotCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).includes('/api/v2/amro/work-packages'));
    expect(snapshotCalls.length).toBe(0);
  });

  it('records flight logs from the aircraft row action', async () => {
    renderAircraftPage();

    const flightLogsAction = await screen.findByRole('button', { name: /Flight Logs actions for N100AA/i }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    await openDropdownAndSelectItem(flightLogsAction, /Add Log/i);

    const addDialogHeading = await screen.findByRole('heading', { name: /Add Flight Logs \(Aircraft:/i }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    expect(addDialogHeading).toBeInTheDocument();
    expect(screen.getByLabelText(/Aircraft Id/i)).toHaveValue('ac-1');
    fireEvent.change(screen.getByLabelText('Arrival Airport'), { target: { value: 'CCU' } });
    fireEvent.change(screen.getByLabelText('Flight Hours'), { target: { value: '2.4' } });
    fireEvent.change(screen.getByLabelText('Block Hours'), { target: { value: '2.9' } });
    fireEvent.change(screen.getByLabelText('Flight Cycles'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Flight Log/i }));
    expect(screen.getByRole('button', { name: /Save Flight Log/i })).toBeInTheDocument();
  });

  it('shows a user-friendly message when flight log save returns not found for aircraft scope', async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation();
    if (!baseFetch) {
      throw new Error('Missing fetch mock implementation');
    }
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      if (method === 'POST' && (url.includes('/api/v2/amro/flight-logs') || url.includes('/api/v2/amro/master-data/flight_logs'))) {
        return {
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ error: 'Not Found' }),
        } as any;
      }
      return baseFetch(input, init);
    });

    renderAircraftPage();
    const flightLogsAction = await screen.findByRole('button', { name: /Flight Logs actions for N100AA/i }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    await openDropdownAndSelectItem(flightLogsAction, /Add Log/i);
    fireEvent.change(screen.getByLabelText('Arrival Airport'), { target: { value: 'CCU' } });
    fireEvent.change(screen.getByLabelText('Flight Hours'), { target: { value: '2.4' } });
    fireEvent.change(screen.getByLabelText('Block Hours'), { target: { value: '2.9' } });
    fireEvent.change(screen.getByLabelText('Flight Cycles'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Flight Log/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('builds aircraft collaborator tooltips from flight logs and falls back when logs are missing', async () => {
    renderAircraftPage();

    await waitFor(() => {
      expect(screen.getAllByText('Captain Rao · Captain').length).toBeGreaterThan(0);
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    expect(screen.getAllByText('FL-100 • 2026-03-25 • DEL → CCU').length).toBeGreaterThan(0);
    expect(screen.getAllByText('FO Sharma · First Officer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Owner Two · No Flight Log Crew').length).toBeGreaterThan(0);
  });

  it('creates flight log records from new flight logs flow using shared form', async () => {
    renderFlightLogsPage();

    await screen.findByLabelText('Flight Date From', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    const newFlightLogsButton = await screen.findByRole('button', { name: /New Flight Logs/i }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    fireEvent.click(newFlightLogsButton);

    const dialogHeading = await screen.findByRole('heading', { name: /New Flight Logs/i }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    expect(dialogHeading).toBeInTheDocument();
    const dialog = await screen.findByRole('dialog', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    fireEvent.change(within(dialog).getByLabelText('Aircraft Id'), { target: { value: 'ac-1' } });
    fireEvent.change(within(dialog).getByLabelText('Departure Airport'), { target: { value: 'DEL' } });
    fireEvent.change(within(dialog).getByLabelText('Arrival Airport'), { target: { value: 'BLR' } });
    fireEvent.change(within(dialog).getByLabelText('Flight Hours'), { target: { value: '1.8' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Create Flight Logs Record/i }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Flight Logs record created');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    const postRequests = vi
      .mocked(fetch)
      .mock.calls.filter(([, init]) => (init?.method || 'GET') === 'POST')
      .map(([input]) => String(input));
    expect(postRequests.some((requestUrl) => requestUrl.includes('/api/v2/amro/master-data/flight_logs'))).toBe(true);
  });

  it('opens aircraft-scoped multi-record flight log view from aircraft list action', async () => {
    renderAircraftPage();

    const flightLogsAction = await screen.findByRole('button', { name: /Flight Logs actions for N100AA/i }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    await openDropdownAndSelectItem(flightLogsAction, /View Logs/i);

    await waitFor(() => {
      const getRequests = vi
        .mocked(fetch)
        .mock.calls.filter(([, init]) => (init?.method || 'GET') === 'GET')
        .map(([input]) => String(input));
      expect(
        getRequests.some(
          (requestUrl) => requestUrl.includes('/api/v2/amro/master-data/flight_logs') && requestUrl.includes('aircraft_id=ac-1'),
        ),
      ).toBe(true);
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('opens flight log detail on row double click and exposes flight log filters', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/flight-logs']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Flight Date From')).toBeInTheDocument();
    expect(screen.getByLabelText('Flight Date To')).toBeInTheDocument();
    expect(screen.getByLabelText('Aircraft Id')).toBeInTheDocument();
    expect(screen.getByLabelText('Pilot')).toBeInTheDocument();

    const flightCell = await screen.findByText('FL-100');
    fireEvent.doubleClick(flightCell);

    expect(await screen.findByRole('heading', { name: 'Flight Log Detail' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Captain Rao')).toBeInTheDocument();
  });

  it('filters flight logs by displayed aircraft and airport labels', async () => {
    renderFlightLogsPage();

    expect(await screen.findByText('N100AA')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter Aircraft'), { target: { value: 'N100AA' } });
    expect(await screen.findByText('N100AA')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter Aircraft'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter Departure'), { target: { value: 'Indira' } });
    expect(await screen.findByText('Indira Gandhi International (VIDP)')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter Departure'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter Arrival'), { target: { value: 'Netaji' } });
    expect(await screen.findByText('Netaji Subhas Chandra Bose (VECC)')).toBeInTheDocument();
  });

  it('hydrates selected row from deep link query parameter', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/aircraft?selected=ac-2']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Selection Summary: Active Record N200AA \| Checked: 0 \| Records: 2/)).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('supports icon-based actions and shows selection state feedback', async () => {
    renderAircraftPage();

    await screen.findByLabelText(/Refresh records/i, {}, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    expect(screen.getAllByLabelText(/Export records/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Run Bulk Import/ })).toBeInTheDocument();

    const rowCheckboxes = await screen.findAllByRole('checkbox', { name: /Select row/ }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    fireEvent.click(rowCheckboxes[0]);
    await waitFor(() => {
      expect(screen.getByText(/Checked: 1/)).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('enforces required fields and rejects malformed date, time, and json values', () => {
    const requiredMatrix: Array<{ entity: keyof typeof AMRO_MASTER_ENTITY_FORM_FIELDS; field: string; message: string }> = [
      { entity: 'aircraft', field: 'tail_number', message: 'Tail Number is required' },
      { entity: 'parts_inventory', field: 'part_number', message: 'Part Number is required' },
      { entity: 'suppliers', field: 'supplier_code', message: 'Supplier Code is required' },
      { entity: 'maintenance_facilities', field: 'facility_code', message: 'Facility Code is required' },
      { entity: 'work_centers', field: 'work_center_code', message: 'Work Center Code is required' },
      { entity: 'skill_codes', field: 'skill_code', message: 'Skill Code is required' },
      { entity: 'manufacturers', field: 'manufacturer_code', message: 'Manufacturer Code is required' },
      { entity: 'regulator_profiles', field: 'regulator_code', message: 'Regulator Code is required' },
      { entity: 'shift_calendars', field: 'station_code', message: 'Station Code is required' },
      { entity: 'work_package_templates', field: 'template_code', message: 'Template Code is required' },
    ];

    requiredMatrix.forEach(({ entity, field, message }) => {
      const result = buildPayloadFromForm(entity, {});
      expect(result.errors[field]).toBe(message);
    });

    const aircraftStatuses = AMRO_MASTER_ENTITY_FORM_FIELDS.aircraft
      .find((field) => field.key === 'status')
      ?.options ?? [];
    expect(aircraftStatuses).toEqual(['active', 'maintenance', 'grounded', 'retired', 'storage']);
    expect(AMRO_MASTER_ENTITY_FORM_FIELDS.aircraft.some((field) => field.key === 'engine_type')).toBe(true);

    const aircraftRetiredStatus = buildPayloadFromForm('aircraft', {
      tail_number: 'N909AA',
      serial_number: 'SN-909',
      aircraft_type: 'NarrowBody',
      manufacturer_id: 'manu-1',
      aircraft_model: 'A320-200',
      status: 'retired',
    });
    expect(aircraftRetiredStatus.errors.status).toBeUndefined();

    const aircraftInvalidStatus = buildPayloadFromForm('aircraft', {
      tail_number: 'N909AB',
      serial_number: 'SN-910',
      aircraft_type: 'NarrowBody',
      manufacturer_id: 'manu-1',
      aircraft_model: 'A320-200',
      status: 'inactive',
    });
    expect(aircraftInvalidStatus.errors.status).toBe('Status is invalid');

    const aircraftOperationalFields = buildPayloadFromForm('aircraft', {
      tail_number: 'N909AC',
      serial_number: 'SN-911',
      aircraft_type: 'NarrowBody',
      manufacturer_id: 'manu-1',
      aircraft_model: 'A320-200',
      status: 'active',
      engine_type: 'CFM56-5B',
      line_number: 'LN-77',
      manufacturing_date: '2026-03-11',
      base_location: 'DXB',
      owner_name: 'Owned',
      current_flight_hours: '2401.7',
      current_cycles: '901',
    });
    expect(aircraftOperationalFields.errors.line_number).toBeUndefined();
    expect(aircraftOperationalFields.errors.manufacturing_date).toBeUndefined();
    expect(aircraftOperationalFields.payload.line_number).toBe('LN-77');
    expect(aircraftOperationalFields.payload.manufacturing_date).toBe('2026-03-11');
    expect(aircraftOperationalFields.payload.engine_type).toBe('CFM56-5B');
    expect(aircraftOperationalFields.payload.base_location).toBe('DXB');
    expect(aircraftOperationalFields.payload.owner_name).toBe('Owned');
    expect(aircraftOperationalFields.payload.current_flight_hours).toBe(2401.7);
    expect(aircraftOperationalFields.payload.current_cycles).toBe(901);

    const aircraftOptionalPlaceholders = buildPayloadFromForm('aircraft', {
      tail_number: 'N909AD',
      serial_number: 'SN-912',
      aircraft_type: 'NarrowBody',
      manufacturer_id: 'manu-1',
      aircraft_model: 'A320-200',
      status: 'active',
      base_location: 'Nothing selected',
      owner_name: 'Nothing selected',
    });
    expect(aircraftOptionalPlaceholders.payload.base_location).toBeUndefined();
    expect(aircraftOptionalPlaceholders.payload.owner_name).toBeUndefined();

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

describe('FlightLogForm utilities', () => {
  it('validates required aircraft and usage constraints', () => {
    const values = getDefaultFlightLogFormValues({
      aircraftId: '',
      departureAirport: 'DEL',
      arrivalAirport: 'DEL',
      flightHours: '0',
      blockHours: '0',
      flightCycles: '0',
    });
    const errors = validateFlightLogFormValues(values);
    expect(errors.aircraftId).toBe('Aircraft Id is required');
    expect(errors.arrivalAirport).toBe('Arrival airport must be different from departure airport');
    expect(errors.flightHours).toBe('Provide at least one positive usage metric');
  });

  it('builds normalized payload for submission', () => {
    const values = getDefaultFlightLogFormValues({
      aircraftId: ' ac-1 ',
      departureAirport: 'del',
      arrivalAirport: 'cCu',
      regulatoryAuthority: 'dgca',
      flightHours: '2.5',
      blockHours: '3.1',
      flightCycles: '1',
      fuelBurnKg: '1400',
      oilUpliftLiters: '4',
    });
    const payload = buildFlightLogPayload(values, 'test-source');
    expect(payload.aircraft_id).toBe('ac-1');
    expect(payload.departure_airport).toBe('DEL');
    expect(payload.arrival_airport).toBe('CCU');
    expect(payload.regulatory_authority).toBe('DGCA');
    expect(payload.metadata.source).toBe('test-source');
  });
});
