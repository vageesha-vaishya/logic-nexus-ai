import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import Dashboards from './Dashboards';
import { BrowserRouter } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardService } from '@/lib/dashboard-service';

// Mock translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (str: string) => str,
  }),
}));

// Mock dashboard data hook
vi.mock('@/hooks/useDashboardData', () => ({
  useDashboardData: () => ({
    loading: false,
    myLeads: [],
    myActivities: [],
    assignableUsers: [],
    leadNamesById: {},
    error: null,
  }),
}));

// Mock DraggableWidget
vi.mock('@/components/dashboard/DraggableWidget', () => ({
  DraggableWidget: ({ config }: any) => (
    <div data-testid={`widget-${config.id}`}>
      {config.title}
    </div>
  ),
}));

// Mock DashboardLayout
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

// Mock CRM hook
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

// Mock toast hook used inside Dashboards
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/dashboard-service', () => ({
  DashboardService: {
    getPreferences: vi.fn().mockResolvedValue(null),
    savePreferences: vi.fn().mockResolvedValue(undefined),
    getTeamMembers: vi.fn().mockResolvedValue([]),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Dashboards', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders dashboard title and loads widget preferences', async () => {
    vi.mocked(useCRM).mockReturnValue({
      scopedDb: {},
      user: { id: 'test-user' },
    });
    vi.mocked(DashboardService.getPreferences).mockResolvedValueOnce([
      { id: 'stats-1', type: 'stats', title: 'KPIs', size: 'full', order: 0 },
      { id: 'leads-1', type: 'leads', title: 'My Leads', size: 'medium', order: 1 },
      { id: 'activities-1', type: 'activities', title: 'My Activities', size: 'medium', order: 2 },
    ]);
    vi.mocked(DashboardService.getTeamMembers).mockResolvedValueOnce([]);
    vi.mocked(DashboardService.savePreferences).mockResolvedValueOnce(undefined);

    render(
      <BrowserRouter>
        <Dashboards />
      </BrowserRouter>
    );

    await screen.findByText('Dashboards');
    expect(DashboardService.getPreferences).toHaveBeenCalled();
  });
});
