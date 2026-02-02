
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import Vendors from './Vendors';
import { BrowserRouter } from 'react-router-dom';

// Mock DashboardLayout
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

// Mock VendorForm
vi.mock('@/components/logistics/VendorForm', () => ({
  VendorForm: () => <div data-testid="vendor-form">Vendor Form Mock</div>,
}));

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Mock Supabase response
const mockVendors = [
  {
    id: '1',
    name: 'Test Carrier',
    code: 'TEST',
    type: 'carrier',
    status: 'active',
    contact_info: { email: 'test@carrier.com' }
  },
  {
    id: '2',
    name: 'Test Agent',
    code: 'AGT',
    type: 'agent',
    status: 'inactive',
    contact_info: { email: 'test@agent.com' }
  }
];

vi.mock('@/hooks/useCRM', () => {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'vendors') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnValue({
            // Mock the Promise-like behavior of Supabase query
            then: (callback: any) => callback({ data: mockVendors, error: null }),
            eq: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
          }),
          delete: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null })
          })),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
      };
    }),
  };

  return {
    useCRM: () => ({
      supabase,
    }),
  };
});

describe('Vendors Page', () => {
  it('renders vendors list successfully', async () => {
    render(
      <BrowserRouter>
        <Vendors />
      </BrowserRouter>
    );

    // Check for title
    expect(screen.getByText('Vendor Management')).toBeInTheDocument();
    
    // Check for loading state (it might happen fast, so we wait for vendors)
    await waitFor(() => {
      expect(screen.getByText('Test Carrier')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Agent')).toBeInTheDocument();
    expect(screen.getByText('carrier')).toBeInTheDocument();
  });

  it('handles empty state', async () => {
    // Override mock for this test
    vi.mocked(await import('@/hooks/useCRM')).useCRM = () => ({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnValue({
            then: (cb: any) => cb({ data: [], error: null }),
            eq: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
          }),
        })) as any
      } as any
    });

    render(
      <BrowserRouter>
        <Vendors />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No vendors found. Add one to get started.')).toBeInTheDocument();
    });
  });
});
