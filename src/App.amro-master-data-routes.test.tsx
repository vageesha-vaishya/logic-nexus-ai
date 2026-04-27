import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./plugins/init', () => ({
  initializePlugins: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    session: null,
    user: null,
    profile: null,
    roles: [],
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
    loading: false,
  }),
}));

vi.mock('./hooks/useCRM', () => ({
  CRMProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCRM: () => ({
    context: { tenantId: null, franchiseId: null, userId: null },
    scopedDb: {},
  }),
}));

vi.mock('./contexts/DomainContext', () => ({
  DomainContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/TenantBrandingContext', () => ({
  TenantBrandingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./hooks/useTheme', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DEFAULT_MENU_GROUP_STRIP_COLORS: {
    crm: '272 85% 55%',
    sales: '217 91% 60%',
    financials: '150 83% 40%',
    logistics: '38 92% 50%',
    amro: '190 95% 42%',
    administration: '310 78% 55%',
    other: '220 15% 60%',
  },
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/layout/StickyActionsContext', () => ({
  StickyActionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./hooks/useLeadsViewState', () => ({
  LeadsViewStateProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/debug/pipeline/PipelineContext', () => ({
  PipelineProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}));

vi.mock('./components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./pages/Landing', () => ({
  default: () => <div>Landing</div>,
}));

vi.mock('./pages/Auth', () => ({
  default: () => <div>Auth</div>,
}));

vi.mock('./pages/OAuthCallback', () => ({
  default: () => <div>OAuthCallback</div>,
}));

vi.mock('./pages/SetupAdmin', () => ({
  default: () => <div>SetupAdmin</div>,
}));

vi.mock('./pages/Unauthorized', () => ({
  default: () => <div>Unauthorized</div>,
}));

vi.mock('./pages/NotFound', () => ({
  default: () => <div>NotFound</div>,
}));

vi.mock('./pages/SelfServiceOnboarding', () => ({
  default: () => <div>SelfServiceOnboarding</div>,
}));

vi.mock('./features/module-amro/settings/pages/AmroMasterDataEntityPages', () => ({
  AircraftMasterDataPage: () => <div data-testid="route-aircraft">aircraft</div>,
  AircraftSubModulePage: () => <div data-testid="route-aircraft-sub-module">aircraft-sub-module</div>,
  AtaCodesMasterDataPage: () => <div data-testid="route-ata-codes">ata-codes</div>,
  PartsInventoryMasterDataPage: () => <div data-testid="route-parts-inventory">parts-inventory</div>,
  SuppliersMasterDataPage: () => <div data-testid="route-suppliers">suppliers</div>,
  MaintenanceFacilitiesMasterDataPage: () => <div data-testid="route-maintenance-facilities">maintenance-facilities</div>,
  WorkCentersMasterDataPage: () => <div data-testid="route-work-centers">work-centers</div>,
  SkillCodesMasterDataPage: () => <div data-testid="route-skill-codes">skill-codes</div>,
  ManufacturersMasterDataPage: () => <div data-testid="route-manufacturers">manufacturers</div>,
  ModelMasterDataPage: () => <div data-testid="route-model">model</div>,
  RegulatorProfilesMasterDataPage: () => <div data-testid="route-regulator-profiles">regulator-profiles</div>,
  ShiftCalendarsMasterDataPage: () => <div data-testid="route-shift-calendars">shift-calendars</div>,
  WorkOrdersMasterDataPage: () => <div data-testid="route-work-orders">work-orders</div>,
  WorkOrderTemplatesMasterDataPage: () => <div data-testid="route-work-order-templates">work-order-templates</div>,
}));

describe('App AMRO master data route mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { path: '/dashboard/amro/settings/master-data/aircraft', marker: 'route-aircraft' },
    { path: '/dashboard/amro/settings/master-data/ata-codes', marker: 'route-ata-codes' },
    { path: '/dashboard/amro/settings/master-data/parts-inventory', marker: 'route-parts-inventory' },
    { path: '/dashboard/amro/settings/master-data/suppliers', marker: 'route-suppliers' },
    { path: '/dashboard/amro/settings/master-data/maintenance-facilities', marker: 'route-maintenance-facilities' },
    { path: '/dashboard/amro/settings/master-data/work-centers', marker: 'route-work-centers' },
    { path: '/dashboard/amro/settings/master-data/skill-codes', marker: 'route-skill-codes' },
    { path: '/dashboard/amro/settings/master-data/manufacturers', marker: 'route-manufacturers' },
    { path: '/dashboard/amro/settings/master-data/model', marker: 'route-model' },
    { path: '/dashboard/amro/settings/master-data/regulator-profiles', marker: 'route-regulator-profiles' },
    { path: '/dashboard/amro/settings/master-data/shift-calendars', marker: 'route-shift-calendars' },
    { path: '/dashboard/amro/settings/master-data/work-orders', marker: 'route-work-orders' },
    { path: '/dashboard/amro/settings/master-data/work-order-templates', marker: 'route-work-order-templates' },
  ])('resolves $path to the expected AMRO wrapper component', async ({ path, marker }) => {
    window.history.pushState({}, 'Route Test', path);
    render(<App />);
    expect(await screen.findByTestId(marker)).toBeInTheDocument();
  });

  it('redirects master data root path to aircraft wrapper route', async () => {
    window.history.pushState({}, 'Redirect Test', '/dashboard/amro/settings/master-data');
    render(<App />);
    expect(await screen.findByTestId('route-aircraft')).toBeInTheDocument();
  });

  it('resolves AMRO aircraft sub-module route', async () => {
    window.history.pushState({}, 'Aircraft Sub-module Route Test', '/dashboard/amro/aircraft');
    render(<App />);
    expect(await screen.findByTestId('route-aircraft-sub-module')).toBeInTheDocument();
  });
});
