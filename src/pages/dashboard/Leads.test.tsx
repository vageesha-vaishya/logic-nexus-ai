import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Leads from './Leads';
import { LeadsViewStateProvider } from '@/hooks/useLeadsViewState';

// Mock heavy/unrelated child components so this stays a focused smoke test.
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/system/FirstScreenTemplate', () => ({
  FirstScreenTemplate: ({ children, title }: any) => (
    <div data-testid="first-screen-template">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('@/components/crm/CRMModuleHeaderNavigation', () => ({
  CRMModuleHeaderNavigation: () => <div data-testid="crm-module-header-nav" />,
  CRM_HEADER_PRIMARY_CONTROL_SEQUENCE: [],
}));

vi.mock('@/features/module-sales/components/LeadsMasterDataFormModal', () => ({
  default: () => <div data-testid="leads-master-data-form-modal" />,
}));

// The global test setup mocks useTranslation with a freshly-created `t`
// function on every call. Leads.tsx has several useCallback/useEffect
// chains keyed on `t`, so an unstable reference here causes an infinite
// render loop. Override with a stable reference for this file.
const stableT = (str: string) => str;
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT, i18n: { language: 'en', changeLanguage: vi.fn() } }),
  Trans: ({ children }: { children: any }) => children,
}));

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const mockLeads = [
  {
    id: 'lead-1',
    first_name: 'John',
    last_name: 'Doe',
    company: 'Acme Logistics',
    email: 'john@example.com',
    phone: '+15551234567',
    status: 'new',
    source: 'website',
    estimated_value: 5000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lead_score: 85,
    qualification_status: 'qualified',
    owner_id: null,
    title: 'Shipping Manager',
  },
  {
    id: 'lead-2',
    first_name: 'Jane',
    last_name: 'Smith',
    company: 'Global Trade Inc',
    email: 'jane@example.com',
    phone: '+15551234568',
    status: 'contacted',
    source: 'referral',
    estimated_value: 12000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lead_score: 65,
    qualification_status: 'qualified',
    owner_id: null,
    title: 'Director of Ops',
  },
];

function createChainableQuery(result: { data: unknown; error: unknown; count?: number }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    is: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
  return builder;
}

// Stable, module-level references -- useCRM() must return the SAME object
// identity across renders (as the real hook does via useMemo), or every
// effect/callback keyed on `scopedDb`/`context` re-fires on every render,
// causing an infinite render loop in a component with this many effects.
const stableSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  },
};

const stableContext = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  franchiseId: null,
};

const stableScopedDb = {
  from: vi.fn((table: string) => {
    if (table === 'leads') {
      return createChainableQuery({ data: mockLeads, error: null, count: mockLeads.length });
    }
    return createChainableQuery({ data: [], error: null, count: 0 });
  }),
  logViewPreference: vi.fn(),
  getSystemSetting: vi.fn().mockResolvedValue({ data: null, error: null }),
  setSystemSetting: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: stableSupabase,
    context: stableContext,
    scopedDb: stableScopedDb,
  }),
}));

describe('Leads', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );
  });

  it('renders the leads toolbar and table without crashing', async () => {
    render(
      <BrowserRouter>
        <LeadsViewStateProvider>
          <Leads />
        </LeadsViewStateProvider>
      </BrowserRouter>,
    );

    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    // The shared test setup mocks useTranslation to return the raw i18n key
    // (ignoring the fallback string), so assert against the key itself.
    expect(screen.getByPlaceholderText('leads.filters.searchPlaceholder')).toBeInTheDocument();
  });
});
