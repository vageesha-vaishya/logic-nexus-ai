import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChargeBreakdown } from '../ChargeBreakdown';
import { exportExcel } from '@/lib/import-export';

// Mock dependencies
vi.mock('@/lib/import-export', () => ({
  exportExcel: vi.fn(),
}));

vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
    Ship: () => <span data-testid="icon-ship">Ship</span>,
    Plane: () => <span data-testid="icon-plane">Plane</span>,
    Truck: () => <span data-testid="icon-truck">Truck</span>,
  };
});

describe('ChargeBreakdown', () => {
  const mockLegs = [
    {
      id: 'leg1',
      mode: 'Ocean - FCL',
      origin: 'Shanghai',
      destination: 'Los Angeles',
      sequence: 1,
      charges: [
        { id: 'c1', name: 'Freight', amount: 1000, currency: 'USD' },
        { id: 'c2', name: 'THC', amount: 200, currency: 'USD' },
      ],
    },
    {
      id: 'leg2',
      mode: 'Road',
      origin: 'Los Angeles',
      destination: 'Las Vegas',
      sequence: 2,
      charges: [
        { id: 'c3', name: 'Trucking', amount: 500, currency: 'USD' },
      ],
    },
    {
      id: 'leg3',
      mode: 'Air',
      origin: 'Las Vegas',
      destination: 'New York',
      sequence: 3,
      charges: [
        { id: 'c4', name: 'Air Freight', amount: 300, currency: 'EUR' },
      ],
    },
  ];

  const mockGlobalCharges = [
    { id: 'g1', name: 'Admin Fee', amount: 50, currency: 'USD' },
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
    // Note: Cities might appear multiple times (as destination of one leg and origin of next)
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

    // USD Total: 1000 + 200 + 500 + 50 = 1750 USD
    // EUR Total: 300 EUR
    // Use regex to be safe against spacing characters
    // Note: getByText fails if multiple found (e.g. in leg header AND footer), so use getAllByText
    expect(screen.getAllByText(/\$1,750\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/€300\.00/).length).toBeGreaterThan(0);
  });

  it('filters legs by mode', () => {
    render(
      <ChargeBreakdown 
        legs={mockLegs} 
        globalCharges={mockGlobalCharges} 
        currency="USD" 
      />
    );

    // Initial: All legs visible
    // Icons exist in filter buttons (always 1) AND in legs
    // Ship: 1 button + 1 leg = 2
    // Truck: 1 button + 1 leg = 2
    // Plane: 1 button + 1 leg = 2
    expect(screen.getAllByTestId('icon-ship')).toHaveLength(2);
    expect(screen.getAllByTestId('icon-truck')).toHaveLength(2);
    expect(screen.getAllByTestId('icon-plane')).toHaveLength(2);

    // Filter Ocean
    fireEvent.click(screen.getByText('Ocean'));
    
    // Ship: 1 button + 1 leg = 2
    expect(screen.getAllByTestId('icon-ship')).toHaveLength(2);
    // Truck: 1 button + 0 legs = 1
    expect(screen.getAllByTestId('icon-truck')).toHaveLength(1);
    // Plane: 1 button + 0 legs = 1
    expect(screen.getAllByTestId('icon-plane')).toHaveLength(1);

    // Reset
    fireEvent.click(screen.getByText('All'));
    expect(screen.getAllByTestId('icon-truck')).toHaveLength(2);
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
    // But wait, the button text is "Export" in both cases.
    // In direct mode: <Button ...> <Download ... /> Export </Button>
    // In dropdown mode: <Button ...> <Download ... /> Export </Button> (trigger)
    
    // However, in direct mode, clicking it triggers handleExportExcel directly.
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
    expect(rows.length).toBe(5); // 1 global + 2 leg1 + 1 leg2 + 1 leg3
  });

  it('calls window.print when print button is clicked (direct mode)', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    
    render(
        <ChargeBreakdown 
            legs={mockLegs} 
            globalCharges={mockGlobalCharges} 
            currency="USD" 
            enableAdvancedFeatures={false}
        />
    );

    const printBtn = screen.getByText('Print');
    fireEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('expands and collapses legs', () => {
    render(
      <ChargeBreakdown 
        legs={mockLegs} 
        globalCharges={mockGlobalCharges} 
        currency="USD" 
      />
    );

    // Legs are expanded by default (logic: isExpanded = expandedLegs[id] ?? true)
    // So "Freight" (charge inside leg1) should be visible
    expect(screen.getByText('Freight')).toBeDefined();

    // Click to collapse first leg (leg1)
    const legHeader = screen.getByTestId('leg-header-leg1');
    fireEvent.click(legHeader);

    // Now "Freight" should NOT be visible
    expect(screen.queryByText('Freight')).toBeNull();
    
    // Click to expand again
    fireEvent.click(legHeader);
    expect(screen.getByText('Freight')).toBeDefined();
  });
});
