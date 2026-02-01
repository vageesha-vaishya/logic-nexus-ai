
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QuickQuoteModal } from '../QuickQuoteModal';
import { useDebug } from '@/hooks/useDebug';
import { useCRM } from '@/hooks/useCRM';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('@/hooks/useDebug');
vi.mock('@/hooks/useCRM');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}));

describe('QuickQuoteModal Logging', () => {
  const mockDebug = {
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  };

  const mockCRM = {
    user: { id: 'test-user', email: 'test@example.com' },
    tenant: { id: 'test-tenant' }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useDebug as any).mockReturnValue(mockDebug);
    (useCRM as any).mockReturnValue(mockCRM);
  });

  const renderModal = (isOpen = true) => {
    return render(
      <BrowserRouter>
        <QuickQuoteModal isOpen={isOpen} onClose={vi.fn()} />
      </BrowserRouter>
    );
  };

  it('logs when modal is opened', () => {
    renderModal(true);
    expect(mockDebug.info).toHaveBeenCalledWith('QuickQuote Modal Opened', expect.any(Object));
  });

  it('logs when smart mode is toggled', async () => {
    renderModal(true);
    
    // Find the Smart Mode switch
    const switchElement = screen.getByRole('switch', { name: /smart mode/i });
    fireEvent.click(switchElement);

    expect(mockDebug.info).toHaveBeenCalledWith('Smart Mode Toggled', expect.objectContaining({
      enabled: false // Defaults to true, so clicking makes it false
    }));
  });

  it('logs when transport mode changes', async () => {
    renderModal(true);

    // Click on "Ocean" tab/button
    // Note: Assuming TabsTrigger renders as button with text "Ocean"
    const oceanTab = screen.getByText('Ocean');
    fireEvent.click(oceanTab);

    expect(mockDebug.log).toHaveBeenCalledWith('Transport Mode Changed', expect.objectContaining({
      mode: 'ocean'
    }));
  });

  it('logs when AI suggestion starts and completes', async () => {
    renderModal(true);
    
    // Enter commodity to trigger AI suggest button availability
    const commodityInput = screen.getByLabelText(/commodity/i);
    fireEvent.change(commodityInput, { target: { value: 'Electronics' } });

    // Mock AI response
    const { supabase } = require('@/integrations/supabase/client');
    supabase.functions.invoke.mockResolvedValueOnce({ 
      data: { suggestion: 'Electronics', hts_code: '8517.12' }, 
      error: null 
    });
    supabase.functions.invoke.mockResolvedValueOnce({ 
      data: { class: 'General' }, 
      error: null 
    });

    // Find and click AI Analyze button
    const aiButton = screen.getByText('AI Analyze');
    await act(async () => {
        fireEvent.click(aiButton);
    });

    // Wait for async operations
    await waitFor(() => {
        expect(mockDebug.info).toHaveBeenCalledWith('Starting AI Suggestion', expect.objectContaining({
            commodity: 'Electronics'
        }));
    });

    await waitFor(() => {
         expect(mockDebug.log).toHaveBeenCalledWith('AI Suggestion Completed', expect.any(Object));
    });
  });

  it('logs when quote is submitted', async () => {
    renderModal(true);

    // Fill required fields to enable submission
    fireEvent.change(screen.getByLabelText(/origin/i), { target: { value: 'NYC' } });
    fireEvent.change(screen.getByLabelText(/destination/i), { target: { value: 'LON' } });
    fireEvent.change(screen.getByLabelText(/commodity/i), { target: { value: 'Electronics' } });
    
    // Submit form
    const submitButton = screen.getByText('Get Standard Quotes');
    await act(async () => {
        fireEvent.click(submitButton);
    });

    expect(mockDebug.info).toHaveBeenCalledWith('Submitting Quote Request', expect.any(Object));
  });
});
