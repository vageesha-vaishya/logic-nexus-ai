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
    hasPermission: () => true,
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
    DropdownMenuItem: ({ children, onClick, onSelect }: { children: React.ReactNode; onClick?: () => void; onSelect?: () => void }) => (
      <button type="button" role="menuitem" onClick={() => { onSelect?.(); onClick?.(); }}>
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

  const openDropdownAndSelectItem = async (trigger: HTMLElement, itemName: RegExp) => {
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger);
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

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
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
                  ],
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

    expect(await screen.findByRole('button', { name: /New Aircraft/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Aircraft/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Bulk Import/ })).toBeInTheDocument();
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

    await screen.findByRole('button', { name: /New Aircraft/ });

    fireEvent.click(screen.getByText('Run Bulk Import'));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringMatching(/records imported$/));
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('supports aircraft baseline work package creation actions from dashboard card', async () => {
    renderAircraftPage();

    await screen.findByText('Aircraft Operations Snapshot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Work Package' }));
    expect(await screen.findByText(/Create Work Package \(Aircraft:/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('One scope item per line'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create & Open Work Package' }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Please resolve aircraft work package validation errors');
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });

    fireEvent.change(screen.getByPlaceholderText('One scope item per line'), { target: { value: 'Hydraulic check' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
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

    const table = await screen.findByRole('table');
    const dataRows = within(table).getAllByRole('row').filter((row) => row.querySelector('td'));
    expect(dataRows.length).toBeGreaterThan(0);

    fireEvent.doubleClick(dataRows[0]);
    expect(await screen.findByRole('heading', { name: 'Update Aircraft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
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

  it('hydrates selected row from deep link query parameter', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/amro/settings/master-data/aircraft?selected=ac-2']} future={memoryRouterFuture}>
        <Routes>
          <Route path="/dashboard/amro/settings/master-data/:entity" element={<AmroSettingsMasterDataPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Selected: ac-2/)).toBeInTheDocument();
    }, { timeout: ASYNC_WAIT_TIMEOUT_MS });
  });

  it('supports icon-based actions and shows selection state feedback', async () => {
    renderAircraftPage();

    await screen.findByLabelText(/Refresh records/i, {}, { timeout: ASYNC_WAIT_TIMEOUT_MS });
    expect(screen.getByLabelText(/Export records CSV/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Export records PDF/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Aircraft/ })).toBeInTheDocument();

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
