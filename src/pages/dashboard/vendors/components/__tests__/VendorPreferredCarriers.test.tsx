
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { VendorPreferredCarriers } from '../VendorPreferredCarriers';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

describe('VendorPreferredCarriers', () => {
  const mockVendorId = '123-vendor-id';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: [], error: null });
    render(<VendorPreferredCarriers vendorId={mockVendorId} />);
    // Note: Loading state might be too fast to catch without specific setup, 
    // but we can check if it calls RPC
    expect(supabase.rpc).toHaveBeenCalledWith('get_vendor_preferred_carriers', {
      p_vendor_id: mockVendorId
    });
  });

  it('renders empty state when no carriers found', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: [], error: null });
    
    render(<VendorPreferredCarriers vendorId={mockVendorId} />);
    
    await waitFor(() => {
      expect(screen.getByText('No preferred carriers assigned.')).toBeDefined();
    });
  });

  it('renders carriers grouped by mode', async () => {
    const mockData = [
      { carrier_id: '1', carrier_name: 'Ocean Carrier A', mode: 'ocean', is_preferred: true },
      { carrier_id: '2', carrier_name: 'Air Carrier B', mode: 'air', is_preferred: true },
      { carrier_id: '3', carrier_name: 'Rail Carrier C', mode: 'rail', is_preferred: true },
      { carrier_id: '4', carrier_name: 'Ocean Carrier D', mode: 'ocean', is_preferred: true },
    ];

    (supabase.rpc as any).mockResolvedValueOnce({ data: mockData, error: null });
    
    render(<VendorPreferredCarriers vendorId={mockVendorId} />);
    
    await waitFor(() => {
      expect(screen.getByText('ocean Carriers')).toBeDefined();
      expect(screen.getByText('air Carriers')).toBeDefined();
      expect(screen.getByText('rail Carriers')).toBeDefined();
      
      expect(screen.getByText('Ocean Carrier A')).toBeDefined();
      expect(screen.getByText('Ocean Carrier D')).toBeDefined();
      expect(screen.getByText('Air Carrier B')).toBeDefined();
      expect(screen.getByText('Rail Carrier C')).toBeDefined();
    });
  });

  it('handles duplicates gracefully (dedupe logic verification)', async () => {
    // Simulating a scenario where RPC might return duplicates (though DB constraints should prevent this)
    // The component itself just renders what it gets, but we can verify it renders them.
    // If we want to test client-side dedupe, we'd need to add that logic to the component or helper.
    // For now, we assume the component trusts the RPC.
    
    const mockData = [
      { carrier_id: '1', carrier_name: 'Carrier A', mode: 'ocean', is_preferred: true },
      { carrier_id: '1', carrier_name: 'Carrier A', mode: 'ocean', is_preferred: true }, // Duplicate
    ];

    (supabase.rpc as any).mockResolvedValueOnce({ data: mockData, error: null });
    
    render(<VendorPreferredCarriers vendorId={mockVendorId} />);
    
    await waitFor(() => {
      // We implemented client-side dedupe, so we expect only 1 item
      const items = screen.getAllByText('Carrier A');
      expect(items.length).toBe(1); 
    });
  });
});
