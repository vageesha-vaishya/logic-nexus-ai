import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import Dashboards from './Dashboards';
import { BrowserRouter } from 'react-router-dom';

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
  });

  it('renders dashboard title and default widgets', () => {
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
