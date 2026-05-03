import { cloneElement, isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
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

expect.extend(toHaveNoViolations);

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
    scopedDb: {
      from: (tableName: string) => {
        const state: {
          tenantId?: string;
          franchiseId?: string | null;
          manufacturerId?: string;
          isActive?: boolean;
          franchiseScopeId?: string;
        } = {};
        const query = {
          select: () => query,
          eq: (column: string, value: string) => {
            if (column === 'tenant_id') {
              state.tenantId = value;
            }
            if (column === 'franchise_id') {
              state.franchiseId = value;
            }
            if (column === 'manufacturer_id') {
              state.manufacturerId = value;
            }
            if (column === 'is_active') {
              state.isActive = String(value) === 'true';
            }
            return query;
          },
          or: (clause: string) => {
            const franchiseMatch = /franchise_id\.eq\.([^,]+)/.exec(String(clause || ''));
            if (franchiseMatch?.[1]) {
              state.franchiseScopeId = franchiseMatch[1];
            }
            return query;
          },
          is: (column: string, value: null) => {
            if (column === 'franchise_id' && value === null) {
              state.franchiseId = null;
            }
            return query;
          },
          order: async () => {
            if (tableName === 'tenants') {
              return {
                data: [
                  { id: 'tenant-1', name: 'Tenant One', is_active: true },
                  { id: 'tenant-2', name: 'Tenant Two', is_active: true },
                ],
                error: null,
              };
            }
            if (tableName === 'franchises') {
              const tenantId = state.tenantId || 'tenant-1';
              return {
                data: tenantId === 'tenant-2'
                  ? [{ id: 'franchise-3', name: 'Franchise Three', tenant_id: 'tenant-2', is_active: true }]
                  : [
                      { id: 'franchise-1', name: 'Franchise One', tenant_id: 'tenant-1', is_active: true },
                      { id: 'franchise-2', name: 'Franchise Two', tenant_id: 'tenant-1', is_active: true },
                    ],
                error: null,
              };
            }
            if (tableName === 'assembly_models') {
              const models = [
                { id: 'amodel-f1-m1', name: 'B737-800', model_code: 'B737-800', aircraft_type: 'NarrowBody', tenant_id: 'tenant-1', franchise_id: 'franchise-1', manufacturer_id: 'manu-1', is_active: true },
                { id: 'amodel-f1-m2', name: 'A320-200', model_code: 'A320-200', aircraft_type: 'NarrowBody', tenant_id: 'tenant-1', franchise_id: 'franchise-1', manufacturer_id: 'manu-2', is_active: true },
                { id: 'amodel-f2-m2', name: 'A321-200', model_code: 'A321-200', aircraft_type: 'NarrowBody', tenant_id: 'tenant-1', franchise_id: 'franchise-2', manufacturer_id: 'manu-2', is_active: true },
                { id: 'amodel-global-m2', name: 'A319-100', model_code: 'A319-100', aircraft_type: 'NarrowBody', tenant_id: 'tenant-1', franchise_id: null, manufacturer_id: 'manu-2', is_active: true },
                { id: 'amodel-t2-m2', name: 'E190', model_code: 'E190', aircraft_type: 'RegionalJet', tenant_id: 'tenant-2', franchise_id: 'franchise-3', manufacturer_id: 'manu-2', is_active: true },
              ];
              const scoped = models.filter((row) => {
                if (state.tenantId && row.tenant_id !== state.tenantId) return false;
                if (state.manufacturerId && row.manufacturer_id !== state.manufacturerId) return false;
                if (state.isActive === true && row.is_active !== true) return false;
                if (state.franchiseScopeId) {
                  return !row.franchise_id || row.franchise_id === state.franchiseScopeId;
                }
                return true;
              });
              return { data: scoped, error: null };
            }
            if (tableName === 'task_templates' && state.tenantId === 'tenant-1' && state.franchiseId === 'franchise-1') {
              return {
                data: [
                  {
                    id: 'task-template-1',
                    task_id: 1,
                    tenant_id: 'tenant-1',
                    franchise_id: 'franchise-1',
                    code_form_no: '05-20',
                    ata_code: '05-20',
                    reference_amp: 'AMM 05-20',
                    description: 'Scheduled Maintenance Checks',
                    category_code: 'OPC',
                    estimated_man_hours: '2.5',
                    revision_status: 'active',
                    interval_hours: 300,
                    interval_cycles: null,
                    interval_months: null,
                    is_mandatory: true,
                  },
                ],
                error: null,
              };
            }
            return { data: [], error: null };
          },
        };
        return query;
      },
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
    v7_startTransition: false,
    v7_relativeSplatPath: true,
  } as const;

  const renderAircraftPage = () => {
    let rendered: ReturnType<typeof render> | undefined;
    act(() => {
      rendered = render(
        <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/aircraft']} future={memoryRouterFuture}>
          <Routes>
            <Route path="/dashboard/amro/settings/master-data/:entity/*" element={<AmroSettingsMasterDataPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    return rendered as ReturnType<typeof render>;
  };
  const renderFlightLogsPage = () => {
    let rendered: ReturnType<typeof render> | undefined;
    act(() => {
      rendered = render(
        <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/flight-logs']} future={memoryRouterFuture}>
          <Routes>
            <Route path="/dashboard/amro/settings/master-data/:entity/*" element={<AmroSettingsMasterDataPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    return rendered as ReturnType<typeof render>;
  };
  const renderWorkOrderTemplatesPage = () => {
    let rendered: ReturnType<typeof render> | undefined;
    act(() => {
      rendered = render(
        <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/work-order-templates']} future={memoryRouterFuture}>
          <Routes>
            <Route path="/dashboard/amro/settings/master-data/:entity/*" element={<AmroSettingsMasterDataPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    return rendered as ReturnType<typeof render>;
  };
  const renderAircraftSubModulePage = (path = '/dashboard/amro/aircraft/list') => {
    let rendered: ReturnType<typeof render> | undefined;
    act(() => {
      rendered = render(
        <MemoryRouter initialEntries={[path]} future={memoryRouterFuture}>
          <Routes>
            <Route
              path="/dashboard/amro/aircraft/*"
              element={<AmroSettingsMasterDataPage entityOverride="aircraft" variant="aircraft-sub-module" />}
            />
          </Routes>
        </MemoryRouter>,
      );
    });
    return rendered as ReturnType<typeof render>;
  };

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
    const originalConsoleError = console.error;
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const message = String(args[0] || '');
      if (message.includes('not wrapped in act')) {
        return;
      }
      originalConsoleError(...args as Parameters<typeof console.error>);
    });
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
        if (method === 'GET' && url.includes('/api/v2/amro/master-data/aircraft_template')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  records: [
                    {
                      id: 'atpl-1',
                      template_name: 'A320 Line Template',
                      aircraft_type: 'A320',
                      manufacturer: 'Airbus',
                      manufacturer_id: 'manu-2',
                      aircraft_model: 'A320-200',
                      maintenance_program: 'MP-A320-LINE',
                      revision_number: '1',
                      amendment_number: '0',
                    },
                  ],
                },
              }),
          };
        }
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
                      aircraft_type: 'NarrowBody',
                      manufacturer_id: 'manu-1',
                      is_active: true,
                    },
                    {
                      id: 'amodel-2',
                      model_code: 'A320-200',
                      name: 'A320-200',
                      aircraft_type: 'NarrowBody',
                      manufacturer_id: 'manu-2',
                      is_active: true,
                    },
                  ],
                },
              }),
          };
        }
        if (method === 'GET' && url.includes('/api/v2/amro/master-data/work_order_templates')) {
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
                      model_id: 'amodel-2',
                      aircraft_model: 'A320-200',
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
                      model_id: 'amodel-3',
                      aircraft_model: 'B737-800',
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
                    open_work_orders: 4,
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
                    configuration_management: {
                      entries: [
                        {
                          engine_serial_number: 'ENG-1001',
                          engine_position: 'L',
                          tsn: 12440,
                          csn: 8421,
                          module: 'CORE',
                        },
                      ],
                    },
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
        if (method === 'GET' && url.includes('/api/v2/amro/pilot-users')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  records: [
                    { user_id: 'pilot-1', display_name: 'Captain Rao', email: 'captain.rao@example.com' },
                    { user_id: 'pilot-2', display_name: 'Captain Iyer', email: 'captain.iyer@example.com' },
                  ],
                  co_pilot_records: [
                    { user_id: 'co-pilot-1', display_name: 'First Officer Das', email: 'fo.das@example.com' },
                  ],
                },
              }),
          };
        }
        if (method === 'GET') {
          if (url.includes('/api/v2/amro/work-orders')) {
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
        if (method === 'POST' && url.includes('/api/v2/amro/master-data/aircraft_template')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  record: {
                    id: 'atpl-new',
                    template_name: 'B737 Heavy Template',
                    aircraft_type: 'B737',
                    manufacturer: 'Boeing',
                    manufacturer_id: 'manu-1',
                    aircraft_model: 'B737-800',
                    maintenance_program: 'MP-B737-HEAVY',
                    revision_number: '3',
                    amendment_number: '1',
                  },
                },
              }),
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
        if (method === 'PATCH' && url.includes('/api/v2/amro/master-data/aircraft_template/')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  record: {
                    id: 'atpl-1',
                    template_name: 'A320 Line Template Updated',
                    aircraft_type: 'A320',
                    manufacturer: 'Airbus',
                    manufacturer_id: 'manu-2',
                    aircraft_model: 'A320-200',
                    maintenance_program: 'MP-A320-LINE',
                    revision_number: '2',
                    amendment_number: '1',
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
        if (method === 'DELETE' && url.includes('/api/v2/amro/master-data/aircraft_template/')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                output: {
                  deleted_id: 'atpl-1',
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
    vi.unstubAllEnvs();
  });

  it('renders all master data modules with shared list layout controls', async () => {
    renderAircraftPage();

    const matrix = [
      { tab: 'Aircraft', entity: 'aircraft', labels: ['Tail Number', 'Aircraft Type'] },
      { tab: 'ATA', entity: 'ata_codes', labels: ['Code', 'Chapter Code'] },
      { tab: 'Parts Inventory', entity: 'parts_inventory', labels: ['Part Number', 'Min Stock Level'] },
      { tab: 'Suppliers', entity: 'suppliers', labels: ['Supplier Code', 'Lead Time (Days)'] },
      { tab: 'Maintenance Facilities', entity: 'maintenance_facilities', labels: ['Facility Code', 'Station Code'] },
      { tab: 'Work Centers', entity: 'work_centers', labels: ['Work Center Code', 'Center Type'] },
      { tab: 'Skill Codes', entity: 'skill_codes', labels: ['Skill Code', 'Skill Family'] },
      { tab: 'Manufacturers', entity: 'manufacturers', labels: ['Manufacturer Code', 'Name'] },
      { tab: 'Model', entity: 'assembly_models', labels: ['Model Code', 'Name'] },
      { tab: 'Regulator Profiles', entity: 'regulator_profiles', labels: ['Regulator Code', 'Policy Version'] },
      { tab: 'Shift Calendars', entity: 'shift_calendars', labels: ['Shift Start', 'Shift End'] },
      { tab: 'Work Package Templates', entity: 'work_order_templates', labels: ['Template Code', 'Maintenance Type'] },
    ];

    for (const entry of matrix) {
      expect(screen.getByRole('tab', { name: entry.tab })).toBeInTheDocument();
      const fields = AMRO_MASTER_ENTITY_FORM_FIELDS[entry.entity as keyof typeof AMRO_MASTER_ENTITY_FORM_FIELDS];
      const fieldLabels = fields.map((field) => field.label);
      for (const label of entry.labels) {
        expect(fieldLabels).toContain(label);
      }
    }

    expect(screen.getByLabelText('Unified module search')).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module status filter')).toBeInTheDocument();
  });

  it('renders aircraft sub-module as standalone AMRO surface without entity tabs', async () => {
    renderAircraftSubModulePage();

    expect(await screen.findByRole('heading', { name: 'AMRO · Aircraft' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'AMRO Overview' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tenant-scoped aircraft operations management with governed CRUD controls, validation, filtering, and exports.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Tenant:/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Refresh records/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export CSV/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export PDF/i })).not.toBeInTheDocument();
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

    const newPartsInventoryButtons = await screen.findAllByRole(
      'button',
      { name: /New\s+Parts Inventory/i },
      { timeout: ASYNC_WAIT_TIMEOUT_MS },
    );
    const newPartsInventoryButton = newPartsInventoryButtons.find((button) => !button.hasAttribute('disabled')) ?? newPartsInventoryButtons[0];
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

    const createButtons = await screen.findAllByRole('button', { name: /New Parts Inventory/ }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    const createButton = createButtons.find((button) => !button.hasAttribute('disabled')) ?? createButtons[0];

    fireEvent.click(createButton);
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

  it('renders unified control row for non-aircraft master data entities and applies search filter behavior', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/parts-inventory']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Unified module search', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module status filter')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /New Parts Inventory/i }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Unified module search'), { target: { value: 'PART-' } });
    await waitFor(() => {
      expect(screen.getByText('PART-100')).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    fireEvent.click(screen.getByRole('button', { name: /Clear filters/i }));
    await waitFor(() => {
      expect(screen.getByText('PART-100')).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('shows entity-specific secondary filters for suppliers, facilities, and work centers', async () => {
    const suppliersRender = render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/suppliers']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Supplier type filter', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    suppliersRender.unmount();

    const facilitiesRender = render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/maintenance-facilities']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText('Facility station filter', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    facilitiesRender.unmount();

    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/work-centers']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText('Work center type filter', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
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
    const workOrderDialog = await screen.findByTestId('amro-aircraft-work-order-dialog');

    const createNewWorkOrderButton = within(workOrderDialog).getByRole('button', { name: 'Create New Work Package' });
    expect(createNewWorkOrderButton).toBeDisabled();
    fireEvent.click(within(workOrderDialog).getByRole('tab', { name: 'Selected task' }));
    expect(within(workOrderDialog).getByRole('button', { name: 'Create New Work Package' })).toBeDisabled();
    fireEvent.click(within(workOrderDialog).getByRole('tab', { name: 'New WP' }));

    expect(await within(workOrderDialog).findByLabelText('Template registry')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(workOrderDialog).getByRole('option', { name: /Line Check Package.*v1/i })).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    const lineTemplateOption = within(workOrderDialog).getByRole('option', { name: /Line Check Package.*v1/i }) as HTMLOptionElement;
    fireEvent.change(within(workOrderDialog).getByLabelText('Template registry', { selector: '#aircraft-wp-template' }), { target: { value: lineTemplateOption.value } });
    expect(within(workOrderDialog).getByRole('button', { name: 'Create New Work Package' })).toBeEnabled();
    fireEvent.click(within(workOrderDialog).getByRole('tab', { name: 'Selected task' }));

    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '145' } });
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Hydraulic inspection campaign' } });
    fireEvent.change(screen.getByLabelText('Revision'), { target: { value: 'R2' } });
    fireEvent.change(screen.getByLabelText('TTAF'), { target: { value: '120.5' } });

    fireEvent.click(screen.getByLabelText('Status'));
    fireEvent.click(await screen.findByRole('option', { name: 'Planning' }));

    fireEvent.click(screen.getByLabelText('Validation'));
    fireEvent.click(await screen.findByRole('option', { name: 'Pending' }));
    fireEvent.click(screen.getByLabelText('Trigger source'));
    fireEvent.click(await screen.findByRole('option', { name: 'Defect' }));

    expect(within(workOrderDialog).getByRole('tab', { name: 'New WP' })).toBeInTheDocument();
    expect(within(workOrderDialog).getByRole('tab', { name: 'Existing WP' })).toBeInTheDocument();
    expect(within(workOrderDialog).getByRole('tab', { name: 'Non performed tasks' })).toBeInTheDocument();
    expect(within(workOrderDialog).getByRole('tab', { name: 'All Tasks' })).toBeInTheDocument();
    expect(within(workOrderDialog).getByRole('tab', { name: 'Selected task' })).toBeInTheDocument();

    fireEvent.click(within(workOrderDialog).getByRole('tab', { name: 'Existing WP' }));
    expect(await within(workOrderDialog).findByText('Apply to Form')).toBeInTheDocument();

    fireEvent.click(within(workOrderDialog).getByRole('tab', { name: 'All Tasks' }));
    expect(await within(workOrderDialog).findByText(/No tasks available for this aircraft context|Task number/i)).toBeInTheDocument();

    fireEvent.click(within(workOrderDialog).getByRole('tab', { name: 'Selected task' }));
    fireEvent.click(within(workOrderDialog).getByRole('checkbox', { name: 'Select all tasks in page' }));
    fireEvent.click(within(workOrderDialog).getByRole('button', { name: 'Create New Work Package' }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Aircraft work package created');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    const createWorkOrderCall = vi
      .mocked(fetch)
      .mock.calls.find(([input, init]) =>
        String(input).includes('/api/v2/amro/work-orders?interface=create-work-order')
        && String(init?.method || 'GET').toUpperCase() === 'POST');
    expect(createWorkOrderCall).toBeDefined();
    const createPayload = JSON.parse(String(createWorkOrderCall?.[1]?.body || '{}')) as Record<string, unknown>;
    expect(createPayload.trigger_source).toBe('defect');
    expect(createPayload.trigger_reference_id).toBe('ac-1');
  });

  it.each([
    ['Schedule Due', 'schedule_due'],
    ['Campaign', 'campaign'],
    ['Predictive Alert', 'predictive_alert'],
  ])('persists FR-AMRO-034 trigger metadata for %s source', async (triggerLabel, triggerValue) => {
    renderAircraftPage();

    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    const workOrderDialog = await screen.findByTestId('amro-aircraft-work-order-dialog');

    expect(await within(workOrderDialog).findByLabelText('Template registry')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(workOrderDialog).getByRole('option', { name: /Line Check Package.*v1/i })).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    const lineTemplateOption = within(workOrderDialog).getByRole('option', { name: /Line Check Package.*v1/i }) as HTMLOptionElement;
    fireEvent.change(within(workOrderDialog).getByLabelText('Template registry', { selector: '#aircraft-wp-template' }), { target: { value: lineTemplateOption.value } });

    fireEvent.click(within(workOrderDialog).getByRole('tab', { name: 'Selected task' }));
    fireEvent.change(screen.getByLabelText('Number'), { target: { value: `145-${triggerValue}` } });
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: `${triggerLabel} verification package` } });
    fireEvent.change(screen.getByLabelText('Revision'), { target: { value: 'R2' } });
    fireEvent.change(screen.getByLabelText('TTAF'), { target: { value: '120.5' } });

    fireEvent.click(screen.getByLabelText('Status'));
    fireEvent.click(await screen.findByRole('option', { name: 'Planning' }));

    fireEvent.click(screen.getByLabelText('Validation'));
    fireEvent.click(await screen.findByRole('option', { name: 'Pending' }));

    fireEvent.click(screen.getByLabelText('Trigger source'));
    fireEvent.click(await screen.findByRole('option', { name: triggerLabel }));

    fireEvent.click(within(workOrderDialog).getByRole('checkbox', { name: 'Select all tasks in page' }));
    fireEvent.click(within(workOrderDialog).getByRole('button', { name: 'Create New Work Package' }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Aircraft work package created');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    const createCalls = vi
      .mocked(fetch)
      .mock.calls
      .filter(([input, init]) =>
        String(input).includes('/api/v2/amro/work-orders?interface=create-work-order')
        && String(init?.method || 'GET').toUpperCase() === 'POST');
    expect(createCalls.length).toBeGreaterThan(0);
    const createPayload = JSON.parse(String(createCalls[createCalls.length - 1]?.[1]?.body || '{}')) as Record<string, unknown>;
    expect(createPayload.source).toBe(triggerValue);
    expect(createPayload.trigger_source).toBe(triggerValue);
    expect(createPayload.trigger_reference_id).toBe('ac-1');
  });

  it('shows New WP template registry errors and supports template refresh retry', async () => {
    const fetchMock = vi.mocked(fetch);
    const baseImplementation = fetchMock.getMockImplementation();
    let templateRegistryCallCount = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'GET' && url.includes('/api/v2/amro/master-data/work_order_templates')) {
        templateRegistryCallCount += 1;
        if (templateRegistryCallCount <= 2) {
          return {
            ok: false,
            text: async () => JSON.stringify({ error: 'Template registry unavailable' }),
          } as Response;
        }
      }
      if (!baseImplementation) {
        throw new Error('Fetch base implementation unavailable');
      }
      return baseImplementation(input, init);
    });

    renderAircraftPage();
    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    const workOrderDialog = await screen.findByTestId('amro-aircraft-work-order-dialog');
    expect(await within(workOrderDialog).findByText('Template registry unavailable')).toBeInTheDocument();

    fireEvent.click(within(workOrderDialog).getByRole('button', { name: 'Refresh Templates' }));
    await waitFor(() => {
      expect(within(workOrderDialog).queryByText('Template registry unavailable')).not.toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    await waitFor(() => {
      expect(within(workOrderDialog).getByRole('option', { name: /Line Check Package.*v1/i })).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('shows empty template registry guidance and keeps create action disabled', async () => {
    const fetchMock = vi.mocked(fetch);
    const baseImplementation = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'GET' && url.includes('/api/v2/amro/master-data/work_order_templates')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ output: { records: [] } }),
        } as Response;
      }
      if (!baseImplementation) {
        throw new Error('Fetch base implementation unavailable');
      }
      return baseImplementation(input, init);
    });

    renderAircraftPage();
    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    const workOrderDialog = await screen.findByTestId('amro-aircraft-work-order-dialog');
    expect(await within(workOrderDialog).findByText('No templates available. Add templates in Template Registry and refresh.')).toBeInTheDocument();
    expect(within(workOrderDialog).getByRole('button', { name: 'Create New Work Package' })).toBeDisabled();
  });

  it('supports template registry payloads that return output.items instead of output.records', async () => {
    const fetchMock = vi.mocked(fetch);
    const baseImplementation = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'GET' && url.includes('/api/v2/amro/master-data/work_order_templates')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              output: {
                items: [
                  {
                    id: 'template-items-1',
                    template_code: 'WP-ITEMS-001',
                    template_name: 'Items Payload Package',
                    description: 'Loaded from output.items',
                    maintenance_type: 'line',
                    version: '3',
                    active: true,
                    scope_json: ['Visual inspection'],
                    tasks_json: [
                      {
                        task_number: '05-40',
                        ata_code: '05-40',
                        serial_number: 'S-001',
                        part_number: 'P-001',
                        description: 'Items payload task',
                      },
                    ],
                  },
                ],
              },
            }),
        } as Response;
      }
      if (!baseImplementation) {
        throw new Error('Fetch base implementation unavailable');
      }
      return baseImplementation(input, init);
    });

    renderAircraftPage();
    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    const workOrderDialog = await screen.findByTestId('amro-aircraft-work-order-dialog');
    await waitFor(() => {
      expect(within(workOrderDialog).getByRole('option', { name: /Items Payload Package.*v3/i })).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    const itemsTemplateOption = within(workOrderDialog).getByRole('option', { name: /Items Payload Package.*v3/i }) as HTMLOptionElement;
    fireEvent.change(within(workOrderDialog).getByLabelText('Template registry', { selector: '#aircraft-wp-template' }), { target: { value: itemsTemplateOption.value } });
    expect(within(workOrderDialog).getByRole('button', { name: 'Create New Work Package' })).toBeEnabled();
  });

  it('supports template registry payloads with nested arrays and template_id fallback binding', async () => {
    const fetchMock = vi.mocked(fetch);
    const baseImplementation = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'GET' && url.includes('/api/v2/amro/master-data/work_order_templates')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              output: {
                data: {
                  registry: {
                    templates: [
                      {
                        template_id: 'tpl-fallback-101',
                        template_code: 'WP-FALLBACK-101',
                        template_name: 'Fallback Id Package',
                        description: 'Loaded from nested output.data.registry.templates',
                        maintenance_type: 'line',
                        version: 5,
                        active: true,
                        tasks_json: [
                          {
                            task_number: '12-34',
                            ata_code: '12-34',
                            serial_number: 'SN-12',
                            part_number: 'PN-12',
                            description: 'Nested payload task',
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            }),
        } as Response;
      }
      if (!baseImplementation) {
        throw new Error('Fetch base implementation unavailable');
      }
      return baseImplementation(input, init);
    });

    renderAircraftPage();
    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    const workOrderDialog = await screen.findByTestId('amro-aircraft-work-order-dialog');
    await waitFor(() => {
      expect(within(workOrderDialog).getByRole('option', { name: /Fallback Id Package.*v5/i })).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    const fallbackTemplateOption = within(workOrderDialog).getByRole('option', { name: /Fallback Id Package.*v5/i }) as HTMLOptionElement;
    fireEvent.change(within(workOrderDialog).getByLabelText('Template registry', { selector: '#aircraft-wp-template' }), { target: { value: fallbackTemplateOption.value } });
    expect(within(workOrderDialog).getByRole('button', { name: 'Create New Work Package' })).toBeEnabled();
  });

  it('surfaces timeout errors for template registry loading', async () => {
    const fetchMock = vi.mocked(fetch);
    const baseImplementation = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'GET' && url.includes('/api/v2/amro/master-data/work_order_templates')) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      if (!baseImplementation) {
        throw new Error('Fetch base implementation unavailable');
      }
      return baseImplementation(input, init);
    });

    renderAircraftPage();
    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    const workOrderDialog = await screen.findByTestId('amro-aircraft-work-order-dialog');
    expect(await within(workOrderDialog).findByText('Request timed out. Please check your connection and retry.')).toBeInTheDocument();
  });

  it('surfaces network errors for template registry loading', async () => {
    const fetchMock = vi.mocked(fetch);
    const baseImplementation = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'GET' && url.includes('/api/v2/amro/master-data/work_order_templates')) {
        throw new TypeError('Failed to fetch');
      }
      if (!baseImplementation) {
        throw new Error('Fetch base implementation unavailable');
      }
      return baseImplementation(input, init);
    });

    renderAircraftPage();
    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    const workOrderDialog = await screen.findByTestId('amro-aircraft-work-order-dialog');
    expect(await within(workOrderDialog).findByText('Network error. Verify connectivity and try again.')).toBeInTheDocument();
  });

  it('surfaces server errors during create-work-order submission and keeps draft', async () => {
    const fetchMock = vi.mocked(fetch);
    const baseImplementation = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'POST' && url.includes('/api/v2/amro/work-orders?interface=create-work-order')) {
        return {
          ok: false,
          status: 503,
          text: async () => JSON.stringify({ error: 'Downstream queue unavailable' }),
        } as Response;
      }
      if (!baseImplementation) {
        throw new Error('Fetch base implementation unavailable');
      }
      return baseImplementation(input, init);
    });

    renderAircraftPage();
    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    const workOrderDialog = await screen.findByTestId('amro-aircraft-work-order-dialog');
    await waitFor(() => {
      expect(within(workOrderDialog).getByRole('option', { name: /Line Check Package.*v1/i })).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    const lineTemplateOption = within(workOrderDialog).getByRole('option', { name: /Line Check Package.*v1/i }) as HTMLOptionElement;
    fireEvent.change(within(workOrderDialog).getByLabelText('Template registry', { selector: '#aircraft-wp-template' }), { target: { value: lineTemplateOption.value } });
    fireEvent.click(within(workOrderDialog).getByRole('tab', { name: 'Selected task' }));
    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '145' } });
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Hydraulic inspection campaign' } });
    fireEvent.change(screen.getByLabelText('Revision'), { target: { value: 'R2' } });
    fireEvent.change(screen.getByLabelText('TTAF'), { target: { value: '120.5' } });
    fireEvent.click(screen.getByLabelText('Status'));
    fireEvent.click(await screen.findByRole('option', { name: 'Planning' }));
    fireEvent.click(screen.getByLabelText('Validation'));
    fireEvent.click(await screen.findByRole('option', { name: 'Pending' }));
    fireEvent.click(within(workOrderDialog).getByRole('checkbox', { name: 'Select all tasks in page' }));
    fireEvent.click(within(workOrderDialog).getByRole('button', { name: 'Create New Work Package' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Work package service is temporarily unavailable. Try again shortly.');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    expect(localStorage.getItem('amro:aircraft-wp-draft:ac-1')).toBeTruthy();
  });

  it('surfaces timeout errors during create-work-order submission', async () => {
    const fetchMock = vi.mocked(fetch);
    const baseImplementation = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'POST' && url.includes('/api/v2/amro/work-orders?interface=create-work-order')) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      if (!baseImplementation) {
        throw new Error('Fetch base implementation unavailable');
      }
      return baseImplementation(input, init);
    });

    renderAircraftPage();
    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    const workOrderDialog = await screen.findByTestId('amro-aircraft-work-order-dialog');
    await waitFor(() => {
      expect(within(workOrderDialog).getByRole('option', { name: /Line Check Package.*v1/i })).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    const lineTemplateOption = within(workOrderDialog).getByRole('option', { name: /Line Check Package.*v1/i }) as HTMLOptionElement;
    fireEvent.change(within(workOrderDialog).getByLabelText('Template registry', { selector: '#aircraft-wp-template' }), { target: { value: lineTemplateOption.value } });
    fireEvent.click(within(workOrderDialog).getByRole('tab', { name: 'Selected task' }));
    fireEvent.change(screen.getByLabelText('Number'), { target: { value: '145' } });
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Hydraulic inspection campaign' } });
    fireEvent.change(screen.getByLabelText('Revision'), { target: { value: 'R2' } });
    fireEvent.change(screen.getByLabelText('TTAF'), { target: { value: '120.5' } });
    fireEvent.click(screen.getByLabelText('Status'));
    fireEvent.click(await screen.findByRole('option', { name: 'Planning' }));
    fireEvent.click(screen.getByLabelText('Validation'));
    fireEvent.click(await screen.findByRole('option', { name: 'Pending' }));
    fireEvent.click(within(workOrderDialog).getByRole('checkbox', { name: 'Select all tasks in page' }));
    fireEvent.click(within(workOrderDialog).getByRole('button', { name: 'Create New Work Package' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Request timed out. Please check your connection and retry.');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('meets baseline accessibility checks for New WP dialog content', async () => {
    renderAircraftPage();
    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    const workOrderDialog = await screen.findByTestId('amro-aircraft-work-order-dialog');
    fireEvent.click(within(workOrderDialog).getByRole('tab', { name: 'New WP' }));

    const result = await axe(workOrderDialog);
    expect(result).toHaveNoViolations();

    const newWpTab = within(workOrderDialog).getByRole('tab', { name: 'New WP' });
    expect(newWpTab).toHaveAttribute('aria-controls');
    expect(within(workOrderDialog).getByLabelText('Template registry', { selector: '#aircraft-wp-template' })).toBeInTheDocument();
    expect(within(workOrderDialog).getByRole('button', { name: /Refresh Templates|Refreshing/i })).toBeInTheDocument();
  });

  it('hides aircraft operations overview in aircraft list workspace while preventing module leakage', async () => {
    renderAircraftPage();

    await screen.findByText('Aircraft Operations Snapshot');
    expect(screen.queryByText('Aircraft Operations Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Maintenance Schedule')).not.toBeInTheDocument();
    expect(screen.queryByText('Defect Tracking')).not.toBeInTheDocument();
    expect(screen.queryByText('Engine Monitoring')).not.toBeInTheDocument();
    expect(screen.queryByText('Engine & Components Monitoring')).not.toBeInTheDocument();
    expect(screen.queryByText('Components Monitoring')).not.toBeInTheDocument();
  });

  it('routes each aircraft sub-module to its dedicated interface without cross-module content leakage', async () => {
    renderAircraftSubModulePage('/dashboard/amro/aircraft/list');
    expect(await screen.findByLabelText('Unified module search', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Aircraft Record' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Aircraft Record' })).toBeEnabled();
    expect(screen.queryByText(/Aircraft · Aircraft List/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Standardized aircraft list controls/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Locale: EN/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Module: list/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fleet size:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Open work packages:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Open defects:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Compliance ready:/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Records per page')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Unified module search'), { target: { value: 'A320' } });

    fireEvent.click(screen.getByRole('button', { name: 'Engine' }));
    expect(await screen.findByText(/View: engine/i, {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module search')).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module status filter')).toBeInTheDocument();
    expect(screen.getByText(/TBO Remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/Engine Operations Command Center/i)).toBeInTheDocument();
    expect(screen.getByText(/Maintenance Scheduling & Tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/Work Order Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Compliance Tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/Performance Analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/Integration & Validation Mesh/i)).toBeInTheDocument();
    expect(screen.getByText(/Performance History Mini-Chart/i)).toBeInTheDocument();
    expect(screen.getByText(/read model assets/i)).toBeInTheDocument();
    expect(screen.getByText(/Lifecycle & Configuration Records/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export engine usability session events as JSON/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export engine usability session events as CSV/i })).toBeInTheDocument();
    expect(screen.getByText(/Engine Data Entry \(Validated\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Validate Entry/i })).toBeInTheDocument();
    expect(screen.getByText(/Serialized Engines/i)).toBeInTheDocument();
    expect(screen.getByText(/Thrust Rating Changes/i)).toBeInTheDocument();
    expect(screen.getByText(/On-Wing Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/ENG-1001 · position L · TSN 12440 · CSN 8421 · module CORE/i)).toBeInTheDocument();
    expect(screen.getByText(/ENG-1001 · L/i)).toBeInTheDocument();
    expect(screen.queryByText(/Components Monitoring/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Components' }));
    expect(await screen.findByText(/View: components/i, {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module search')).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module status filter')).toBeInTheDocument();
    expect(screen.getByText(/AD\/SB Compliance:/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Records per page')).not.toBeInTheDocument();
    expect(screen.queryByText(/Document Repository/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Documents' }));
    expect(await screen.findByText(/Documents Management/i, {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module search')).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module status filter')).toBeInTheDocument();
    expect(screen.getByText(/Document Repository/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Document category')).not.toBeInTheDocument();
    expect(screen.queryByText(/Engine Drill-down/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'AD/SB' }));
    expect(await screen.findByText(/AD\/SB Management/i, {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module search')).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module status filter')).toBeInTheDocument();
    expect(screen.getByText(/AD\/SB Compliance Management/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('AD/SB compliance state')).not.toBeInTheDocument();
    expect(screen.queryByText(/Document Repository/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(await screen.findByRole('heading', { name: 'Aircraft Template Registry' }, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module search')).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module status filter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Template' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Template aircraft type')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Template manufacturer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aircraft List' }));
    expect(await screen.findByLabelText('Unified module search')).toBeInTheDocument();
    expect(screen.queryByLabelText('Records per page')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Unified module search')).toHaveValue('A320');
  });

  it('disables unified New action in aircraft sub-module when create permissions are missing', async () => {
    mockHasPermission.mockImplementation(() => false);
    renderAircraftSubModulePage('/dashboard/amro/aircraft/list');
    expect(await screen.findByLabelText('Unified module search', {}, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    const newButton = screen.getByRole('button', { name: 'New Aircraft Record' });
    expect(newButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New Aircraft Record' })).toBeDisabled();
  });

  it('renders aircraft templates workspace and validates required create fields', async () => {
    renderAircraftSubModulePage('/dashboard/amro/aircraft/templates');

    expect(await screen.findByRole('heading', { name: 'Aircraft Template Registry' }, { timeout: ASYNC_WAIT_TIMEOUT_MS })).toBeInTheDocument();
    expect(await screen.findByText('A320 Line Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module search')).toBeInTheDocument();
    expect(screen.getByLabelText('Unified module status filter')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New Template' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Create Aircraft Template' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Template' }));
    expect(await within(dialog).findByText('Template Name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Aircraft Type is required')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Template Name'), { target: { value: 'B737 Heavy Template' } });
    fireEvent.change(within(dialog).getByLabelText('Aircraft Type'), { target: { value: 'B737' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Template' }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Aircraft template created');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('renders aircraft header navigation in relocated sequence with active module state', async () => {
    renderAircraftSubModulePage('/dashboard/amro/aircraft/list');

    await screen.findByText('Aircraft Operations Snapshot');

    const toolbar = screen.getByRole('toolbar', { name: 'Aircraft header actions' });
    const orderedLabels = within(toolbar).getAllByRole('button').map((button) => button.textContent?.trim());
    expect(orderedLabels).toEqual([
      'Aircraft List',
      'Templates',
      'Engine',
      'Components',
      'Documents',
      'AD/SB',
      'Operations',
    ]);
    expect(within(toolbar).getByRole('button', { name: 'Go to Aircraft List' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(toolbar).getByRole('button', { name: 'Go to Engine' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Go to Operations' })).toBeInTheDocument();
  });

  it('hides legacy aircraft header actions from the relocated navigation bar', async () => {
    renderAircraftPage();
    await screen.findByText('Aircraft Operations Snapshot');
    const toolbar = screen.getByRole('toolbar', { name: 'Aircraft header actions' });
    expect(within(toolbar).queryByRole('button', { name: 'List view' })).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: /New aircraft record/i })).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: 'Aircraft template workspace' })).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: 'Grid view' })).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: 'Card view' })).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: 'Pipeline view' })).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: 'Analytics view' })).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: 'Import and export workspace' })).not.toBeInTheDocument();
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
    const baseSelect = within(formDialog).getByLabelText(/^Base$/i);
    expect(baseSelect).toBeInTheDocument();
    expect(within(baseSelect).getByRole('option', { name: 'DEL' })).toBeInTheDocument();

    const ownerSelect = within(formDialog).getByLabelText(/^Owner$/i);
    expect(ownerSelect).toBeInTheDocument();
    expect(within(ownerSelect).getByRole('option', { name: 'Owner One' })).toBeInTheDocument();
  });

  it('filters aircraft model listbox options by selected manufacturer in aircraft create form', async () => {
    renderAircraftPage();
    const rowCheckbox = await screen.findByRole('checkbox', { name: 'Select row ac-1' });
    const aircraftRow = rowCheckbox.closest('tr');
    expect(aircraftRow).not.toBeNull();
    fireEvent.doubleClick(aircraftRow as HTMLElement);
    const dialog = await screen.findByTestId('amro-master-data-form-dialog');

    const manufacturerSelect = within(dialog).getByLabelText(/Manufacturer/i);
    fireEvent.change(manufacturerSelect, { target: { value: 'manu-2' } });

    const modelSelect = within(dialog).getByLabelText(/^Aircraft Model:/i);
    expect(within(modelSelect).getByRole('option', { name: 'A320-200' })).toBeInTheDocument();
    expect(within(modelSelect).queryByRole('option', { name: 'B737-800' })).not.toBeInTheDocument();
    fireEvent.change(modelSelect, { target: { value: 'A320-200' } });
    const typeSelect = within(dialog).getByLabelText(/^Aircraft Type:/i);
    expect(typeSelect).toHaveValue('NarrowBody');
    fireEvent.change(manufacturerSelect, { target: { value: 'manu-1' } });
    expect(typeSelect).toHaveValue('');
  });

  it('refreshes aircraft model options in real-time for tenant-franchise-manufacturer combinations', async () => {
    renderAircraftPage();
    const rowCheckbox = await screen.findByRole('checkbox', { name: 'Select row ac-1' });
    const aircraftRow = rowCheckbox.closest('tr');
    expect(aircraftRow).not.toBeNull();
    fireEvent.doubleClick(aircraftRow as HTMLElement);
    const dialog = await screen.findByTestId('amro-master-data-form-dialog');

    const tenantSelect = within(dialog).getByLabelText(/^Tenant$/i);
    const franchiseSelect = within(dialog).getByLabelText(/^Franchise$/i);
    const manufacturerSelect = within(dialog).getByLabelText(/Manufacturer/i);
    const modelSelect = within(dialog).getByLabelText(/^Aircraft Model:/i);

    fireEvent.change(tenantSelect, { target: { value: 'tenant-1' } });
    fireEvent.change(franchiseSelect, { target: { value: 'franchise-1' } });
    fireEvent.change(manufacturerSelect, { target: { value: 'manu-2' } });

    await waitFor(() => {
      expect(within(modelSelect).getByRole('option', { name: 'A320-200' })).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    expect(within(modelSelect).queryByRole('option', { name: 'A321-200' })).not.toBeInTheDocument();

    fireEvent.change(franchiseSelect, { target: { value: 'franchise-2' } });
    await waitFor(() => {
      expect(within(modelSelect).getByRole('option', { name: 'A321-200' })).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    expect(within(modelSelect).queryByRole('option', { name: 'A320-200' })).not.toBeInTheDocument();

    fireEvent.change(tenantSelect, { target: { value: 'tenant-2' } });
    fireEvent.change(franchiseSelect, { target: { value: 'franchise-3' } });
    fireEvent.change(manufacturerSelect, { target: { value: 'manu-2' } });
    await waitFor(() => {
      expect(within(modelSelect).getByRole('option', { name: 'E190' })).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
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

    const manufacturerSelect = within(createDialog).getByLabelText(/^Manufacturer:/i);
    fireEvent.change(manufacturerSelect, { target: { value: 'manu-2' } });

    const modelSelect = within(createDialog).getByLabelText(/^Aircraft Model:/i);
    fireEvent.change(modelSelect, { target: { value: 'A320-200' } });

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

    const manufacturerSelect = within(dialog).getByLabelText(/^Manufacturer:/i);
    expect(within(manufacturerSelect).getByRole('option', { name: 'Unable to load manufacturers' })).toBeInTheDocument();
  });

  it('hides configured work package columns while preserving filter and export actions', async () => {
    renderWorkOrderTemplatesPage();

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
    renderWorkOrderTemplatesPage();

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
    const aircraftModelSelect = screen.getByLabelText('Aircraft Model') as HTMLSelectElement;
    expect(aircraftModelSelect).toHaveValue('amodel-2');
    expect(aircraftModelSelect).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('keeps legacy work package form path when standard template flag is off', async () => {
    vi.stubEnv('VITE_AMRO_WPT_STANDARD_TEMPLATE', 'false');
    renderWorkOrderTemplatesPage();

    const table = await screen.findByRole('table');
    const dataRows = within(table).getAllByRole('row').filter((row) => row.querySelector('td'));
    fireEvent.doubleClick(dataRows[0]);

    expect(await screen.findByRole('heading', { name: 'Update Work Package Templates' })).toBeInTheDocument();
    expect(screen.queryByTestId('amro-wpt-standard-template')).not.toBeInTheDocument();
    expect(screen.getByText('Work Package Details')).toBeInTheDocument();
  });

  it('uses standard template adapter for work package form when feature flag is on', async () => {
    vi.stubEnv('VITE_AMRO_WPT_STANDARD_TEMPLATE', 'true');
    renderWorkOrderTemplatesPage();

    const table = await screen.findByRole('table');
    const dataRows = within(table).getAllByRole('row').filter((row) => row.querySelector('td'));
    fireEvent.doubleClick(dataRows[0]);

    expect(await screen.findByRole('heading', { name: 'Update Work Package Templates' })).toBeInTheDocument();
    expect(screen.getByTestId('amro-wpt-standard-template')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Code (Standard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Name (Standard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Aircraft Model (Standard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Scope JSON (Standard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Tasks JSON (Standard)')).toBeInTheDocument();
    expect(screen.getByText('Related Records')).toBeInTheDocument();
    expect(screen.getByText('Selected Tasks (live runtime table)')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Runtime Metadata')).toBeInTheDocument();
    expect(screen.queryByText('Work Package Template Registry')).not.toBeInTheDocument();
    expect(screen.getByText('Work Package Details')).toBeInTheDocument();
    expect(screen.getByText('Selected Tasks')).toBeInTheDocument();
    expect(screen.getByText('Scope Definition')).toBeInTheDocument();
    const scopeJsonInput = screen.getByLabelText('Scope JSON (Standard)');
    const tasksJsonInput = screen.getByLabelText('Tasks JSON (Standard)');
    fireEvent.change(scopeJsonInput, { target: { value: '[{"phase":"line"}]' } });
    fireEvent.change(tasksJsonInput, { target: { value: '[{"task_number":"01-00"}]' } });
    expect((scopeJsonInput as HTMLTextAreaElement).value).toBe('[{"phase":"line"}]');
    expect((tasksJsonInput as HTMLTextAreaElement).value).toMatch(/^\[/);
  });

  it('keeps selected tasks header/filter UI parity with sort and summary behavior', async () => {
    vi.stubEnv('VITE_AMRO_WPT_STANDARD_TEMPLATE', 'true');
    renderWorkOrderTemplatesPage();

    const table = await screen.findByRole('table');
    const dataRows = within(table).getAllByRole('row').filter((row) => row.querySelector('td'));
    fireEvent.doubleClick(dataRows[0]);

    expect(await screen.findByRole('heading', { name: 'Update Work Package Templates' })).toBeInTheDocument();
    expect(screen.getByTestId('wpt-selected-tasks-header-row')).toBeInTheDocument();
    expect(screen.getByTestId('wpt-selected-tasks-filter-row')).toBeInTheDocument();

    for (const header of ['Task ID', 'Code Form No', 'ATA Code', 'Reference AMP', 'Description', 'Category Code', 'Estimated Man Hours', 'Is Mandatory', 'JSON_Details']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(header.replace('_', '[_ ]'), 'i') })).toBeInTheDocument();
    }

    const taskSortButton = screen.getByRole('button', { name: /Sort Task ID \(asc\)/i });
    fireEvent.click(taskSortButton);
    expect(screen.getByRole('button', { name: /Sort Task ID \(desc\)/i })).toBeInTheDocument();

    const taskFilterInput = screen.getByLabelText('Filter Task ID');
    fireEvent.change(taskFilterInput, { target: { value: 'NO-MATCH-TASK-ID' } });
    expect(screen.getByText('No task rows available for selected aircraft model')).toBeInTheDocument();

    const summary = screen.getByTestId('wpt-selected-tasks-summary');
    expect(summary).toBeInTheDocument();
    expect(summary.textContent || '').toMatch(/Selection Summary: Checked \d+ \| Records: \d+/);
  });

  it('shows navigation error toast when double-clicked work package row has no record id', async () => {
    const baseFetch = vi.mocked(fetch).getMockImplementation();
    if (!baseFetch) {
      throw new Error('Missing fetch mock implementation');
    }
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      if (method === 'GET' && url.includes('/api/v2/amro/master-data/work_order_templates')) {
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

    renderWorkOrderTemplatesPage();
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
      const view = renderWorkOrderTemplatesPage();
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
        .mock.calls.filter(([input]) => String(input).includes('/api/v2/amro/work-orders'));
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
      .mock.calls.filter(([input]) => String(input).includes('/api/v2/amro/work-orders'));
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

    expect(screen.queryByLabelText(/Refresh records/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Export records/i)).not.toBeInTheDocument();
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
      { entity: 'ata_codes', field: 'code', message: 'Code is required' },
      { entity: 'parts_inventory', field: 'part_number', message: 'Part Number is required' },
      { entity: 'suppliers', field: 'supplier_code', message: 'Supplier Code is required' },
      { entity: 'maintenance_facilities', field: 'facility_code', message: 'Facility Code is required' },
      { entity: 'work_centers', field: 'work_center_code', message: 'Work Center Code is required' },
      { entity: 'skill_codes', field: 'skill_code', message: 'Skill Code is required' },
      { entity: 'manufacturers', field: 'manufacturer_code', message: 'Manufacturer Code is required' },
      { entity: 'regulator_profiles', field: 'regulator_code', message: 'Regulator Code is required' },
      { entity: 'shift_calendars', field: 'station_code', message: 'Station Code is required' },
      { entity: 'work_order_templates', field: 'template_code', message: 'Template Code is required' },
    ];

    requiredMatrix.forEach(({ entity, field, message }) => {
      const result = buildPayloadFromForm(entity, {});
      expect(result.errors[field]).toBe(message);
    });

    const aircraftStatuses = AMRO_MASTER_ENTITY_FORM_FIELDS.aircraft
      .find((field) => field.key === 'status')
      ?.options ?? [];
    expect(aircraftStatuses).toEqual(['active', 'pending', 'maintenance', 'grounded', 'retired', 'storage']);
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
      aircraft_operators_id: '157b8d12-c115-446e-a4dc-d12077751fe2',
      aircraft_owners_id: '257b8d12-c115-446e-a4dc-d12077751fe2',
      aircraft_base_location_id: '357b8d12-c115-446e-a4dc-d12077751fe2',
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
    expect(aircraftOperationalFields.payload.aircraft_operators_id).toBe('157b8d12-c115-446e-a4dc-d12077751fe2');
    expect(aircraftOperationalFields.payload.aircraft_owners_id).toBe('257b8d12-c115-446e-a4dc-d12077751fe2');
    expect(aircraftOperationalFields.payload.aircraft_base_location_id).toBe('357b8d12-c115-446e-a4dc-d12077751fe2');
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
      aircraft_operators_id: '',
      aircraft_owners_id: '',
      aircraft_base_location_id: '',
    });
    expect(aircraftOptionalPlaceholders.payload.base_location).toBeUndefined();
    expect(aircraftOptionalPlaceholders.payload.owner_name).toBeUndefined();
    expect(aircraftOptionalPlaceholders.payload.aircraft_operators_id).toBeUndefined();
    expect(aircraftOptionalPlaceholders.payload.aircraft_owners_id).toBeUndefined();
    expect(aircraftOptionalPlaceholders.payload.aircraft_base_location_id).toBeUndefined();

    const aircraftInvalidOwners = buildPayloadFromForm('aircraft', {
      tail_number: 'N909AE',
      serial_number: 'SN-913',
      aircraft_type: 'NarrowBody',
      manufacturer_id: 'manu-1',
      aircraft_model: 'A320-200',
      status: 'active',
      aircraft_operators_id: 'invalid-operator-id',
      aircraft_owners_id: 'invalid-owner-id',
      aircraft_base_location_id: 'invalid-base-location-id',
    });
    expect(aircraftInvalidOwners.errors.aircraft_operators_id).toBe('Operator Owner must be a valid UUID');
    expect(aircraftInvalidOwners.errors.aircraft_owners_id).toBe('Aircraft Owner must be a valid UUID');
    expect(aircraftInvalidOwners.errors.aircraft_base_location_id).toBe('Base Location must be a valid UUID');

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

    const templateMalformedJson = buildPayloadFromForm('work_order_templates', {
      template_code: 'TMP-1',
      template_name: 'Template',
      maintenance_type: 'line',
      version: 1,
      scope_json: '[{"phase":"inspection"}',
    });
    expect(templateMalformedJson.errors.scope_json).toBe('Scope JSON must be valid JSON');

    const ataMalformedChapterCode = buildPayloadFromForm('ata_codes', {
      code: '27-10',
      chapter_code: '270',
    });
    expect(ataMalformedChapterCode.errors.chapter_code).toBe('Chapter Code must be exactly 2 characters');
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
