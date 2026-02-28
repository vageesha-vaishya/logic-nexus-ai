import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showQuotationSuccessToast } from '../QuotationSuccessToast';
import { toast } from 'sonner';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    custom: vi.fn(),
    dismiss: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock clipboard
const mockClipboard = {
  writeText: vi.fn(),
};
Object.assign(navigator, { clipboard: mockClipboard });

describe('QuotationSuccessToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls toast.custom with correct options', () => {
    showQuotationSuccessToast('QUO-2024-001');
    expect(toast.custom).toHaveBeenCalledWith(expect.any(Function), {
      duration: 5000,
      position: 'top-right',
    });
  });

  it('renders notification content correctly', () => {
    showQuotationSuccessToast('QUO-2024-001');
    const renderFn = (toast.custom as any).mock.calls[0][0];
    const toastId = 'test-id';
    
    render(renderFn(toastId));

    expect(screen.getByText('Quotation Created Successfully')).toBeInTheDocument();
    expect(screen.getByText('Quotation #QUO-2024-001 has been successfully created.')).toBeInTheDocument();
  });

  it('copies quotation number to clipboard', async () => {
    showQuotationSuccessToast('QUO-2024-001');
    const renderFn = (toast.custom as any).mock.calls[0][0];
    render(renderFn('test-id'));

    const copyButton = screen.getByRole('button', { name: /Copy quotation number/i });
    fireEvent.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('QUO-2024-001');
    expect(toast.success).toHaveBeenCalledWith('Copied to clipboard');
  });

  it('dismisses toast on close button click', () => {
    showQuotationSuccessToast('QUO-2024-001');
    const renderFn = (toast.custom as any).mock.calls[0][0];
    const toastId = 'test-id';
    render(renderFn(toastId));

    const closeButton = screen.getByRole('button', { name: /Dismiss notification/i });
    fireEvent.click(closeButton);

    expect(toast.dismiss).toHaveBeenCalledWith(toastId);
  });

  it('dismisses toast on Escape key', () => {
    showQuotationSuccessToast('QUO-2024-001');
    const renderFn = (toast.custom as any).mock.calls[0][0];
    const toastId = 'test-id';
    render(renderFn(toastId));

    const toastContainer = screen.getByRole('alert');
    fireEvent.keyDown(toastContainer, { key: 'Escape' });

    expect(toast.dismiss).toHaveBeenCalledWith(toastId);
  });
});
