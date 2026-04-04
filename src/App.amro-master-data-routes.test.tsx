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
}));

vi.mock('./hooks/useCRM', () => ({
  CRMProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/DomainContext', () => ({
  DomainContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/TenantBrandingContext', () => ({
  TenantBrandingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./hooks/useTheme', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  PartsInventoryMasterDataPage: () => <div data-testid="route-parts-inventory">parts-inventory</div>,
  SuppliersMasterDataPage: () => <div data-testid="route-suppliers">suppliers</div>,
  MaintenanceFacilitiesMasterDataPage: () => <div data-testid="route-maintenance-facilities">maintenance-facilities</div>,
  WorkCentersMasterDataPage: () => <div data-testid="route-work-centers">work-centers</div>,
  SkillCodesMasterDataPage: () => <div data-testid="route-skill-codes">skill-codes</div>,
  ManufacturersMasterDataPage: () => <div data-testid="route-manufacturers">manufacturers</div>,
  ModelMasterDataPage: () => <div data-testid="route-model">model</div>,
  RegulatorProfilesMasterDataPage: () => <div data-testid="route-regulator-profiles">regulator-profiles</div>,
  ShiftCalendarsMasterDataPage: () => <div data-testid="route-shift-calendars">shift-calendars</div>,
  WorkPackagesMasterDataPage: () => <div data-testid="route-work-packages">work-packages</div>,
  WorkPackageTemplatesMasterDataPage: () => <div data-testid="route-work-package-templates">work-package-templates</div>,
}));

describe('App AMRO master data route mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { path: '/dashboard/amro/settings/master-data/aircraft', marker: 'route-aircraft' },
    { path: '/dashboard/amro/settings/master-data/parts-inventory', marker: 'route-parts-inventory' },
    { path: '/dashboard/amro/settings/master-data/suppliers', marker: 'route-suppliers' },
    { path: '/dashboard/amro/settings/master-data/maintenance-facilities', marker: 'route-maintenance-facilities' },
    { path: '/dashboard/amro/settings/master-data/work-centers', marker: 'route-work-centers' },
    { path: '/dashboard/amro/settings/master-data/skill-codes', marker: 'route-skill-codes' },
    { path: '/dashboard/amro/settings/master-data/manufacturers', marker: 'route-manufacturers' },
    { path: '/dashboard/amro/settings/master-data/model', marker: 'route-model' },
    { path: '/dashboard/amro/settings/master-data/regulator-profiles', marker: 'route-regulator-profiles' },
    { path: '/dashboard/amro/settings/master-data/shift-calendars', marker: 'route-shift-calendars' },
    { path: '/dashboard/amro/settings/master-data/work-packages', marker: 'route-work-packages' },
    { path: '/dashboard/amro/settings/master-data/work-package-templates', marker: 'route-work-package-templates' },
    { path: '/dashboard/amro/settings/work-package-templates', marker: 'route-work-package-templates' },
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
