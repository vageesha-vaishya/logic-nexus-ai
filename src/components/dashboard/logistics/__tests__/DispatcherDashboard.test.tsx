import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DispatcherDashboard } from '../DispatcherDashboard';

// Mock all the widget components
vi.mock('../widgets/LiveRouteMap', () => ({
  LiveRouteMap: () => <div data-testid="live-route-map">Live Route Map Widget</div>,
}));

vi.mock('../widgets/ShipmentQueue', () => ({
  ShipmentQueue: () => <div data-testid="shipment-queue">Shipment Queue Widget</div>,
}));

vi.mock('../widgets/DriverStatus', () => ({
  DriverStatus: () => <div data-testid="driver-status">Driver Status Widget</div>,
}));

vi.mock('../widgets/AlertsIssues', () => ({
  AlertsIssues: () => <div data-testid="alerts-issues">Alerts Issues Widget</div>,
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, title, ...props }: any) => (
    <button onClick={onClick} title={title} {...props}>{children}</button>
  ),
}));

vi.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  Maximize2: () => <span>Maximize</span>,
  Minimize2: () => <span>Minimize</span>,
}));

describe('DispatcherDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard title and description', () => {
    render(<DispatcherDashboard />);

    expect(screen.getByText('Dispatcher Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Monitor active routes, shipments, drivers, and operational alerts')).toBeInTheDocument();
  });

  it('renders all default widgets', () => {
    render(<DispatcherDashboard />);

    expect(screen.getByTestId('live-route-map')).toBeInTheDocument();
    expect(screen.getByTestId('shipment-queue')).toBeInTheDocument();
    expect(screen.getByTestId('driver-status')).toBeInTheDocument();
    expect(screen.getByTestId('alerts-issues')).toBeInTheDocument();
  });

  it('renders widget titles correctly', () => {
    render(<DispatcherDashboard />);

    expect(screen.getByText('Live Routes')).toBeInTheDocument();
    expect(screen.getByText('Shipment Queue')).toBeInTheDocument();
    expect(screen.getByText('Driver Status')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
  });

  it('removes widget when remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<DispatcherDashboard />);

    const removeButtons = screen.getAllByTitle('Remove widget');
    const initialCount = screen.getAllByTestId('card').length;

    await user.click(removeButtons[0]);

    const cardsAfter = screen.queryAllByTestId('card');
    expect(cardsAfter.length).toBeLessThan(initialCount);
  });

  it('toggles widget maximize/minimize on button click', async () => {
    const user = userEvent.setup();
    render(<DispatcherDashboard />);

    const maximizeButtons = screen.getAllByTitle('Maximize');
    expect(maximizeButtons.length).toBeGreaterThan(0);

    await user.click(maximizeButtons[0]);

    // Widget should still be present after resize
    expect(screen.getByTestId('live-route-map')).toBeInTheDocument();
  });

  it('shows reset button when all widgets removed', async () => {
    const user = userEvent.setup();
    render(<DispatcherDashboard />);

    const removeButtons = screen.getAllByTitle('Remove widget');

    // Remove all widgets
    for (const button of removeButtons) {
      await user.click(button);
    }

    expect(screen.getByText('All widgets have been removed')).toBeInTheDocument();
    expect(screen.getByText('Reset Dashboard')).toBeInTheDocument();
  });

  it('resets dashboard when reset button clicked', async () => {
    const user = userEvent.setup();
    render(<DispatcherDashboard />);

    const removeButtons = screen.getAllByTitle('Remove widget');

    // Remove all widgets
    for (const button of removeButtons) {
      await user.click(button);
    }

    const resetButton = screen.getByText('Reset Dashboard');
    await user.click(resetButton);

    // Should show all widgets again
    expect(screen.getByTestId('live-route-map')).toBeInTheDocument();
    expect(screen.getByTestId('shipment-queue')).toBeInTheDocument();
    expect(screen.getByTestId('driver-status')).toBeInTheDocument();
    expect(screen.getByTestId('alerts-issues')).toBeInTheDocument();
  });

  it('applies correct grid classes to widgets', () => {
    const { container } = render(<DispatcherDashboard />);

    const gridDiv = container.querySelector('.grid');
    expect(gridDiv).toHaveClass('grid-cols-1');
    expect(gridDiv).toHaveClass('gap-4');
  });

  it('renders all cards with hover effect', () => {
    const { container } = render(<DispatcherDashboard />);

    const cards = container.querySelectorAll('[data-testid="card"]');
    cards.forEach(card => {
      expect(card).toHaveClass('hover:shadow-lg');
    });
  });

  it('renders correct number of default widgets', () => {
    render(<DispatcherDashboard />);

    const cards = screen.getAllByTestId('card');
    expect(cards.length).toBe(4); // Four default widgets
  });

  it('maintains widget state across operations', async () => {
    const user = userEvent.setup();
    render(<DispatcherDashboard />);

    // Check initial state
    expect(screen.getByTestId('live-route-map')).toBeInTheDocument();

    // Click maximize
    const maximizeButtons = screen.getAllByTitle('Maximize');
    await user.click(maximizeButtons[0]);

    // Widget should still be there
    expect(screen.getByTestId('live-route-map')).toBeInTheDocument();

    // Remove a different widget
    const removeButtons = screen.getAllByTitle('Remove widget');
    await user.click(removeButtons[1]);

    // First widget should still be there
    expect(screen.getByTestId('live-route-map')).toBeInTheDocument();
  });
});
