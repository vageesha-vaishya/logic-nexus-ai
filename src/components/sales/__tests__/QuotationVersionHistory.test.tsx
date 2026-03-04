import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuotationVersionHistory } from '../QuotationVersionHistory';
import { BrowserRouter } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';

// Mock hooks
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

// Mock toast
vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

// Mock complex child components
vi.mock('../quotation-versions/PDFGenerator', () => ({
  PDFGenerator: () => <button>PDF</button>,
}));

vi.mock('../quotation-versions/ApprovalWorkflow', () => ({
  ApprovalWorkflow: () => <div>Approval</div>,
}));

vi.mock('../VersionStatusSelector', () => ({
  VersionStatusSelector: () => <div>Status</div>,
}));

vi.mock('../quotation-versions/CustomerSelectionDialog', () => ({
  CustomerSelectionDialog: () => <div>Customer Selection</div>,
}));

vi.mock('../quotation-versions/VersionComparison', () => ({
  VersionComparison: () => <div>Comparison</div>,
}));

// Mock simple mocks for lucide-react icons
vi.mock('lucide-react', async () => {
  return {
    Clock: () => <span>Clock</span>,
    Trash2: () => <span>Trash</span>,
    Plus: () => <span>Plus</span>,
    CheckCircle: () => <span>Check</span>,
    GitCompare: () => <span>Compare</span>,
    FileText: () => <span>File</span>,
    Edit2: () => <span>EditIcon</span>,
    Check: () => <span>CheckIcon</span>,
    TrendingUp: () => <span>Trend</span>,
    DollarSign: () => <span>Dollar</span>,
    Loader2: () => <span>Loading</span>,
    ChevronDown: () => <span>Down</span>,
    GitBranch: () => <span>GitBranch</span>,
    ArrowLeft: () => <span>ArrowLeft</span>,
    ArrowRight: () => <span>ArrowRight</span>,
    MoreHorizontal: () => <span>More</span>,
    AlertCircle: () => <span>Alert</span>,
    RefreshCw: () => <span>Refresh</span>,
  };
});

describe('QuotationVersionHistory', () => {
  const mockQuoteId = 'quote-123';
  const mockVersionId = 'ver-1';
  const mockOptionId = 'opt-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to the correct URL with optionId when edit button is clicked', async () => {
    // Setup mock data
    const mockVersions = [
      {
        id: mockVersionId,
        quote_id: mockQuoteId,
        version_number: 1,
        kind: 'major',
        status: 'DRAFT',
        created_at: '2023-01-01T00:00:00Z',
        is_current: true
      }
    ];

    const mockOptions = [
      {
        id: mockOptionId,
        quotation_version_id: mockVersionId,
        carrier_rate_id: 'rate-1',
        option_name: 'Test Option',
        carrier_name: 'Carrier A',
        total_amount: 1000,
        currency: 'USD',
        transit_time_days: 10,
        total_buy: 800,
        total_sell: 1000,
        margin_amount: 200,
        margin_percentage: 20
      }
    ];

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table) => {
        if (table === 'quotes') {
          return {
            select: vi.fn((fields) => {
              // Return appropriate data based on selected fields
              if (fields && fields.includes('tenant_id')) {
                return {
                  eq: vi.fn().mockReturnThis(),
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { tenant_id: 'tenant-1', franchise_id: 'franchise-1' },
                    error: null
                  }),
                  abortSignal: vi.fn().mockReturnThis(),
                };
              }
              return {
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockReturnThis(),
                abortSignal: vi.fn().mockResolvedValue({ 
                  data: { current_version_id: mockVersionId }, 
                  error: null 
                }),
              };
            }),
          };
        }
        if (table === 'quotation_versions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            abortSignal: vi.fn().mockResolvedValue({ 
              data: mockVersions, 
              error: null 
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      })
    };

    const mockScopedDb = {
      from: vi.fn((table) => {
        if (table === 'quotation_version_options') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            abortSignal: vi.fn().mockResolvedValue({ 
              data: mockOptions, 
              error: null 
            }),
          };
        }
        if (table === 'carrier_rates') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            abortSignal: vi.fn().mockResolvedValue({ 
              data: [{ id: 'rate-1', carrier_name: 'Carrier A', currency: 'USD', base_rate: 100 }], 
              error: null 
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      })
    };

    (useCRM as any).mockReturnValue({
      supabase: mockSupabase,
      scopedDb: mockScopedDb,
    });

    render(
      <BrowserRouter>
        <QuotationVersionHistory quoteId={mockQuoteId} />
      </BrowserRouter>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Version 1')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Test Option')).toBeInTheDocument();
    });

    // Find and click the edit button
    const editButton = screen.getByRole('button', { name: /edit/i });
    expect(editButton).toBeInTheDocument();
    
    fireEvent.click(editButton);

    // Verify navigation
    expect(mockNavigate).toHaveBeenCalledWith(
      `/dashboard/quotes/${mockQuoteId}?versionId=${mockVersionId}&optionId=${mockOptionId}`
    );
  });
});
