import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuotePreviewModal } from './QuotePreviewModal';
import * as SupabaseFunctions from '@/lib/supabase-functions';

// Mock dependencies
vi.mock('@/lib/supabase-functions', () => ({
  invokeAnonymous: vi.fn(),
}));

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock window.atob
global.atob = vi.fn((str) => Buffer.from(str, 'base64').toString('binary'));

describe('QuotePreviewModal', () => {
  const defaultProps = {
    quoteId: 'test-quote-id',
    quoteNumber: 'Q-123',
    versionId: 'v1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue('blob:test-url');
  });

  it('renders the preview button', () => {
    render(<QuotePreviewModal {...defaultProps} />);
    expect(screen.getByText('Preview PDF')).toBeDefined();
  });

  it('opens modal and generates PDF on click', async () => {
    // Mock successful response
    const mockContent = Buffer.from('fake-pdf-content').toString('base64');
    (SupabaseFunctions.invokeAnonymous as any).mockResolvedValue({ content: mockContent });

    render(<QuotePreviewModal {...defaultProps} />);
    
    const button = screen.getByText('Preview PDF');
    fireEvent.click(button);

    // Check modal opens
    expect(screen.getByText('Preview Quote #Q-123')).toBeDefined();
    
    // Check loading state
    expect(screen.getByText('Generating PDF Preview...')).toBeDefined();

    // Wait for PDF generation
    await waitFor(() => {
      expect((SupabaseFunctions.invokeAnonymous as any).mock.calls[0][0]).toBe('generate-quote-pdf');
      const payload = (SupabaseFunctions.invokeAnonymous as any).mock.calls[0][1];
      expect(payload.quoteId).toBe('test-quote-id');
      expect(payload.versionId).toBe('v1');
    });

    // Check if iframe is rendered
    await waitFor(() => {
      const iframe = screen.getByTitle('PDF Preview');
      expect(iframe).toBeDefined();
      expect(iframe.getAttribute('src')).toContain('blob:test-url');
    });
  });

  it('handles PDF generation error', async () => {
    // Mock error response
    (SupabaseFunctions.invokeAnonymous as any).mockRejectedValue(new Error('Generation failed'));

    render(<QuotePreviewModal {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Preview PDF'));

    await waitFor(() => {
      expect(screen.getByText('Preview Generation Failed')).toBeDefined();
      expect(screen.getByText('Generation failed')).toBeDefined();
    });
  });

  it('allows retrying after error', async () => {
    // Mock error first
    (SupabaseFunctions.invokeAnonymous as any)
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValueOnce({ content: Buffer.from('success').toString('base64') });

    render(<QuotePreviewModal {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Preview PDF'));

    await waitFor(() => {
      expect(screen.getByText('Temporary error')).toBeDefined();
    });

    // Click Try Again
    fireEvent.click(screen.getByText('Try Again'));

    await waitFor(() => {
      expect(screen.getByTitle('PDF Preview')).toBeDefined();
    });
  });
});
