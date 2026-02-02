
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VendorDocumentDialog } from '../components/VendorDocumentDialog';
import * as React from 'react';

// Mock dependencies
const mockUpload = vi.fn();
const mockInsert = vi.fn();
const mockRpc = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      from: (table: string) => {
        if (table === 'vendor_documents') {
            return {
                insert: mockInsert.mockReturnValue({ 
                  select: mockSelect.mockReturnValue({ 
                    single: mockSingle.mockReturnValue({ data: { id: 'doc-123', name: 'Test Doc' }, error: null }) 
                  }) 
                }),
                update: mockUpdate.mockReturnValue({ 
                    eq: mockEq.mockResolvedValue({ error: null }) 
                })
            };
        }
        return {};
      },
      storage: {
        from: () => ({
          upload: mockUpload.mockReturnValue({ error: null }),
        }),
      },
      rpc: mockRpc.mockReturnValue({ data: true, error: null }),
    },
  }),
}));

// Mock UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div role="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
    Select: ({ children, onValueChange }: any) => {
        return <div data-testid="select-wrapper" onClick={() => onValueChange && onValueChange('1')}>{children}</div>
    },
    SelectTrigger: ({ children }: any) => <button>{children}</button>,
    SelectValue: () => <span>Select Value</span>,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
}));

// Mock FileUpload
vi.mock('@/components/common/FileUpload', () => ({
    FileUpload: ({ onFileSelect }: any) => (
        <div data-testid="file-upload" onClick={() => onFileSelect(new File(['dummy content'], 'test.pdf', { type: 'application/pdf' }))}>
            Upload File
        </div>
    )
}));

describe('VendorDocumentDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();
  const folders = [
    { id: '1', name: 'Contracts' },
    { id: '2', name: 'Compliance' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockReturnValue({ data: { id: 'doc-123', name: 'Test Doc' }, error: null });
    mockRpc.mockReturnValue({ data: true, error: null });
  });

  it('renders correctly when open', () => {
    render(
      <VendorDocumentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        vendorId="vendor-123"
        folders={folders}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByRole('heading', { name: 'Add Document' })).toBeInTheDocument();
    expect(screen.getByText('Document Name')).toBeInTheDocument();
    expect(screen.getByText('Folder')).toBeInTheDocument();
  });

  it('submits form with correct payload including folder_id', async () => {
    render(
      <VendorDocumentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        vendorId="vendor-123"
        folders={folders}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('e.g. Liability Insurance 2026'), {
      target: { value: 'Test Doc' },
    });

    fireEvent.change(screen.getByPlaceholderText('https://...'), {
      target: { value: 'https://example.com/doc.pdf' },
    });

    // Simulate selecting a folder (mocked Select calls onValueChange with '1')
    fireEvent.click(screen.getAllByTestId('select-wrapper')[0]);

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Add Document' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled();
    });

    // Check payload
    const payload = mockInsert.mock.calls[0][0];
    expect(payload).toMatchObject({
        vendor_id: 'vendor-123',
        name: 'Test Doc',
        folder_id: '1', // Should be '1' because we clicked the first select wrapper
        url: 'https://example.com/doc.pdf'
    });
  });

  it('simulates virus scan after submission', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    render(
      <VendorDocumentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        vendorId="vendor-123"
        folders={folders}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('e.g. Liability Insurance 2026'), {
      target: { value: 'Test Virus Scan' },
    });

    // Simulate file selection
    fireEvent.click(screen.getByTestId('file-upload'));

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Add Document' });
    fireEvent.click(submitBtn);

    // Wait for submission (insert)
    await waitFor(() => {
        expect(mockInsert).toHaveBeenCalled();
    });

    // Check setTimeout was called
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
    
    // Manually trigger the callback
    const callback = setTimeoutSpy.mock.calls.find(call => call[1] === 3000)?.[0];
    if (typeof callback === 'function') {
        // We cast to any because TS might complain about arguments
        await (callback as any)();
    }
    
    // Check if update was called
    expect(mockUpdate).toHaveBeenCalled();
    
    // Check update payload
    const updatePayload = mockUpdate.mock.calls[0][0];
    expect(updatePayload).toMatchObject({
        virus_scan_status: 'clean'
    });
    
    setTimeoutSpy.mockRestore();
  });
});
