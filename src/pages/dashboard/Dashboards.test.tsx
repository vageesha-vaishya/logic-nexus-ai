import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import Dashboards from './Dashboards';
import { BrowserRouter } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

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

  it('renders dashboard title and default widgets', () => {
    (useCRM as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      scopedDb: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [] })),
            })),
            order: vi.fn(() => Promise.resolve({ data: [] })),
          })),
        })),
      },
      user: { id: 'test-user' },
    });

    render(
      <BrowserRouter>
        <Dashboards />
      </BrowserRouter>
    );

    expect(screen.getByText('Dashboards')).toBeInTheDocument();
    
    // Check for default widgets
    expect(screen.getByText('KPIs')).toBeInTheDocument();
    expect(screen.getByText('My Leads')).toBeInTheDocument();
    expect(screen.getByText('My Activities')).toBeInTheDocument();
  });
});
