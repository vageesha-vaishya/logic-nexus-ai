import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChargeBreakdown } from '../ChargeBreakdown';
import { exportExcel } from '@/lib/import-export';

// Mock dependencies
vi.mock('@/lib/import-export', () => ({
  exportExcel: vi.fn(),
}));

// Mock DropdownMenu to avoid Radix UI pointer event issues in JSDOM
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode, onClick?: () => void }) => (
    <div onClick={onClick} role="menuitem">{children}</div>
  ),
}));

// Removed lucide-react mock as it was causing issues. 
// We will test presence/absence of leg content by text instead.

describe('ChargeBreakdown', () => {
  const mockLegs = [
    {
      id: 'leg1',
      mode: 'Ocean - FCL',
      origin: 'Shanghai',
      destination: 'Los Angeles',
      sequence: 1,
      charges: [
        { id: 'c1', name: 'Freight', amount: 1000, currency: 'USD', category: 'Freight' },
        { id: 'c2', name: 'THC', amount: 200, currency: 'USD', category: 'Origin' },
      ],
    },
    {
      id: 'leg2',
      mode: 'Road',
      origin: 'Los Angeles',
      destination: 'Las Vegas',
      sequence: 2,
      charges: [
        { id: 'c3', name: 'Trucking', amount: 500, currency: 'USD', category: 'Transport' },
      ],
    },
    {
      id: 'leg3',
      mode: 'Air',
      origin: 'Las Vegas',
      destination: 'New York',
      sequence: 3,
      charges: [
        { id: 'c4', name: 'Air Freight', amount: 300, currency: 'EUR', category: 'Freight' },
      ],
    },
  ];

  const mockGlobalCharges = [
    { id: 'g1', name: 'Admin Fee', amount: 50, currency: 'USD', category: 'Documentation' },
  ];

  it('renders all legs and global charges correctly', () => {
    render(
      <ChargeBreakdown 
        legs={mockLegs} 
        globalCharges={mockGlobalCharges} 
        currency="USD" 
      />
    );

    // Check legs
    expect(screen.getAllByText(/Shanghai/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Los Angeles/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Las Vegas/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/New York/).length).toBeGreaterThan(0);

    // Check global charge
    expect(screen.getByText('Admin Fee')).toBeDefined();
    expect(screen.getByText(/\$50\.00/)).toBeDefined();
  });

  it('calculates totals with mixed currencies correctly', () => {
    render(
      <ChargeBreakdown 
        legs={mockLegs} 
        globalCharges={mockGlobalCharges} 
        currency="USD" 
      />
    );

    expect(screen.getAllByText(/\$1,750\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/€300\.00/).length).toBeGreaterThan(0);
  });

  it('filters legs by mode', () => {
    const { rerender } = render(
      <ChargeBreakdown 
        legs={mockLegs} 
        globalCharges={mockGlobalCharges} 
        currency="USD" 
        activeFilter={null}
      />
    );

    // Initial: All legs visible
    expect(screen.getAllByText('Ocean - FCL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Road').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Air').length).toBeGreaterThan(0);

    // Apply Filter: Ocean
    rerender(
      <ChargeBreakdown 
        legs={mockLegs} 
        globalCharges={mockGlobalCharges} 
        currency="USD" 
        activeFilter={{ type: 'mode', value: 'Ocean' }}
      />
    );
    
    // Ocean should remain
    expect(screen.getAllByText('Ocean - FCL').length).toBeGreaterThan(0);
    // Road and Air should be gone
    expect(screen.queryByText('Road')).toBeNull();
    expect(screen.queryByText('Air')).toBeNull();

    // Reset (Clear Filter)
    rerender(
        <ChargeBreakdown 
          legs={mockLegs} 
          globalCharges={mockGlobalCharges} 
          currency="USD" 
          activeFilter={null}
        />
    );
    expect(screen.getAllByText('Road').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Air').length).toBeGreaterThan(0);
  });

  it('calls exportExcel when export button is clicked (direct mode)', () => {
    render(
        <ChargeBreakdown 
            legs={mockLegs} 
            globalCharges={mockGlobalCharges} 
            currency="USD" 
            enableAdvancedFeatures={false}
        />
    );

    // In direct mode (advanced=false), buttons are directly visible
    const exportBtn = screen.getByText('Export');
    fireEvent.click(exportBtn);

    expect(exportExcel).toHaveBeenCalledWith(
      'charge_breakdown.xlsx',
      expect.any(Array), // Headers
      expect.any(Array)  // Rows
    );

    // Verify some row data in the call
    const calls = (exportExcel as any).mock.calls;
    const rows = calls[0][2];
    expect(rows.length).toBe(5); 
  });

  it('calls window.print when print button is clicked', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    
    render(
        <ChargeBreakdown 
            legs={mockLegs} 
            globalCharges={mockGlobalCharges} 
            currency="USD" 
            enableAdvancedFeatures={true} 
        />
    );

    // Open dropdown
    const exportBtn = screen.getByText('Export');
    fireEvent.click(exportBtn);

    // Use findByText with a slightly longer timeout just in case
    const printBtn = await screen.findByText('Print / Save PDF', {}, { timeout: 2000 });
    fireEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('expands and collapses legs in grouped view', async () => {
    render(
      <ChargeBreakdown 
        legs={mockLegs} 
        globalCharges={mockGlobalCharges} 
        currency="USD" 
      />
    );

    // Switch to Grouped View
    const groupedBtn = screen.getByText('Grouped');
    fireEvent.click(groupedBtn);

    // Legs are expanded by default
    // Use "THC" which is unique to Leg 1
    const thcElements = await screen.findAllByText('THC');
    expect(thcElements.length).toBeGreaterThan(0);

    // Click to collapse first leg (leg1)
    const legHeader = screen.getByTestId('leg-header-leg1');
    fireEvent.click(legHeader);

    // Now "THC" should NOT be visible
    await waitFor(() => {
      expect(screen.queryByText('THC')).toBeNull();
    });
    
    // Click to expand again
    fireEvent.click(legHeader);
    expect(screen.getAllByText('THC').length).toBeGreaterThan(0);
  });
});
