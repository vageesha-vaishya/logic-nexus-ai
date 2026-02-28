import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuotesPipeline from './QuotesPipeline';
import { useCRM } from '@/hooks/useCRM';
import { supabase } from '@/integrations/supabase/client';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { stages } from './quotes-data';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

// Mock dependencies
vi.mock('@/hooks/useCRM');
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user' },
    profile: { first_name: 'Test', last_name: 'User', email: 'test@example.com' },
    signOut: vi.fn(),
    roles: [],
    permissions: [],
    loading: false,
    hasRole: vi.fn(),
    hasPermission: vi.fn(),
    isPlatformAdmin: vi.fn(() => true),
  })),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/lib/db/access', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    withScope: vi.fn((query) => Promise.resolve({ data: [], error: null })),
    ScopedDataAccess: class {
      constructor() {}
      from = vi.fn().mockReturnThis();
      select = vi.fn().mockReturnThis();
      order = vi.fn().mockResolvedValue({ data: [], error: null });
      limit = vi.fn().mockReturnThis();
      update = vi.fn().mockReturnThis();
      delete = vi.fn().mockReturnThis();
      eq = vi.fn().mockResolvedValue({ error: null });
      in = vi.fn().mockResolvedValue({ error: null });
    },
  };
});

// Mock DashboardLayout to avoid context issues
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>
}));

// Mock SwimLane to debug rendering
vi.mock('@/components/kanban/SwimLane', () => ({
  SwimLane: ({ title, children }: any) => <div data-testid="swim-lane"><div>{title}</div>{children}</div>
}));

// Mock DND kit to avoid sensor issues in tests
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core');
  return {
    ...actual,
    useSensor: vi.fn(),
    useSensors: vi.fn(),
    useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
    useDraggable: vi.fn(() => ({ setNodeRef: vi.fn(), listeners: {}, attributes: {}, transform: null })),
    DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

describe('QuotesPipeline', () => {
  const mockContext = {
    isPlatformAdmin: true,
    tenantId: 'tenant-1',
    franchiseId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockScopedDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
      in: vi.fn().mockResolvedValue({ error: null }),
    };

    (useCRM as any).mockReturnValue({ context: mockContext, scopedDb: mockScopedDb });
    
    // Mock supabase chain
    const mockSelect = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockReturnThis();
    
    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      order: mockOrder,
      limit: mockLimit,
    });
  });

  it('renders pipeline title', async () => {
    render(
      <BrowserRouter>
        <QuotesPipeline />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Quotes Pipeline')).toBeInTheDocument();
  });

  it('renders new quote button', async () => {
    render(
      <BrowserRouter>
        <QuotesPipeline />
      </BrowserRouter>
    );

    const buttons = screen.getAllByText('New Quote');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('fetches quotes on mount', async () => {
    expect(stages.length).toBeGreaterThan(0);
    render(
      <BrowserRouter>
        <QuotesPipeline />
      </BrowserRouter>
    );

    // Wait for loading to finish and content to appear
    await waitFor(() => {
      expect(screen.queryByText('Loading quotes...')).not.toBeInTheDocument();
    });
  });

  it('renders swim lanes', async () => {
    render(
      <BrowserRouter>
        <QuotesPipeline />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('swim-lane')).toBeInTheDocument();
      expect(screen.getByText('All Quotes')).toBeInTheDocument();
    });
  });
});
