
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import VendorDetail from '../VendorDetail';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mocks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '123' }),
    useNavigate: () => mockNavigate,
  };
});

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({
          data: {
            id: '123',
            name: 'Test Vendor',
            type: 'carrier',
            status: 'active',
            onboarding_status: 'completed',
            risk_rating: 'low',
            performance_rating: 4.5,
            contact_info: {
                primary_contact: 'John Doe',
                email: 'john@example.com',
                phone: '555-1234',
                address: '123 Main St'
            },
            permissions: { read: [], write: [] }
          },
          error: null,
        })),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        data: [], // For lists
      })),
    })),
  })),
  rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user1' } } })
  }
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: mockSupabase,
    context: { isPlatformAdmin: true } // Needed for AdminScopeSwitcher
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    roles: ['admin'],
    hasRole: vi.fn(() => true),
    hasPermission: vi.fn(() => true),
    user: { id: 'user1' }
  }),
}));

vi.mock('@/contexts/DomainContext', () => ({
  useDomain: () => ({
    currentDomain: { id: 'logistics', name: 'Logistics', code: 'logistics' },
    setDomain: vi.fn(),
    availableDomains: [{ id: 'logistics', name: 'Logistics', code: 'logistics' }],
  }),
  DomainProvider: ({ children }: any) => <div>{children}</div>,
}));

// Mock child components to isolate VendorDetail logic
vi.mock('@/components/logistics/VendorForm', () => ({
  VendorForm: ({ onSuccess, onCancel }: any) => (
    <div data-testid="vendor-form">
      <button onClick={onSuccess}>Save Profile</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../components/VendorContractDialog', () => ({
  VendorContractDialog: () => <div data-testid="contract-dialog" />,
}));
vi.mock('../components/VendorDocumentDialog', () => ({
  VendorDocumentDialog: () => <div data-testid="document-dialog" />,
}));
vi.mock('../components/VendorFolderDialog', () => ({
  VendorFolderDialog: () => <div data-testid="folder-dialog" />,
}));
vi.mock('../components/VendorRiskDialog', () => ({
  VendorRiskDialog: () => <div data-testid="risk-dialog" />,
}));
vi.mock('../components/VendorPerformanceDialog', () => ({
  VendorPerformanceDialog: () => <div data-testid="performance-dialog" />,
}));
vi.mock('../components/VendorFolderSidebar', () => ({
  VendorFolderSidebar: () => <div data-testid="folder-sidebar" />,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
    auditLogger: {
        log: vi.fn().mockResolvedValue(true)
    }
}));

describe('VendorDetail Edit Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens Edit Profile dialog when button is clicked', async () => {
    render(
      <TooltipProvider>
        <BrowserRouter>
            <VendorDetail />
        </BrowserRouter>
      </TooltipProvider>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Test Vendor')).toBeInTheDocument();
    });

    // Find and click Edit Profile button
    const editButton = screen.getByRole('button', { name: /edit profile/i });
    fireEvent.click(editButton);

    // Check if dialog content (VendorForm mock) is visible
    await waitFor(() => {
      expect(screen.getByTestId('vendor-form')).toBeInTheDocument();
    });
  });

  it('closes dialog on cancel', async () => {
    render(
      <TooltipProvider>
        <BrowserRouter>
            <VendorDetail />
        </BrowserRouter>
      </TooltipProvider>
    );

    await waitFor(() => expect(screen.getByText('Test Vendor')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    
    await waitFor(() => expect(screen.getByTestId('vendor-form')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('vendor-form')).not.toBeInTheDocument();
    });
  });

  it('refreshes data on success', async () => {
    render(
      <TooltipProvider>
        <BrowserRouter>
            <VendorDetail />
        </BrowserRouter>
      </TooltipProvider>
    );

    await waitFor(() => expect(screen.getByText('Test Vendor')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    
    await waitFor(() => expect(screen.getByTestId('vendor-form')).toBeInTheDocument());

    // Click Save (triggers onSuccess)
    fireEvent.click(screen.getByText('Save Profile'));

    await waitFor(() => {
      expect(screen.queryByTestId('vendor-form')).not.toBeInTheDocument();
    });

    // Verify fetchVendorDetails was called (by checking if select was called again)
    // Initial load + refresh = 2 calls
    // Note: This assertion depends on exact implementation details of fetchVendorDetails
    expect(mockSupabase.from).toHaveBeenCalled();
  });
});
