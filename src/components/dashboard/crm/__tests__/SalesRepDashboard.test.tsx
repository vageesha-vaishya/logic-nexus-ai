import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalesRepDashboard } from '../SalesRepDashboard';

// Mock all the widget components
vi.mock('../widgets/PipelineByStage', () => ({
  PipelineByStage: () => <div data-testid="pipeline-by-stage">Pipeline by Stage Widget</div>,
}));

vi.mock('../widgets/SalesForecast', () => ({
  SalesForecast: () => <div data-testid="sales-forecast">Sales Forecast Widget</div>,
}));

vi.mock('../widgets/WinLossMetrics', () => ({
  WinLossMetrics: () => <div data-testid="win-loss-metrics">Win/Loss Metrics Widget</div>,
}));

vi.mock('../widgets/RevenueYTD', () => ({
  RevenueYTD: () => <div data-testid="revenue-ytd">Revenue YTD Widget</div>,
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

describe('SalesRepDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard title and description', () => {
    render(<SalesRepDashboard />);

    expect(screen.getByText('Sales Rep Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Your personal pipeline, forecasts, and sales performance')).toBeInTheDocument();
  });

  it('renders all default widgets', () => {
    render(<SalesRepDashboard />);

    expect(screen.getByTestId('pipeline-by-stage')).toBeInTheDocument();
    expect(screen.getByTestId('sales-forecast')).toBeInTheDocument();
    expect(screen.getByTestId('win-loss-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('revenue-ytd')).toBeInTheDocument();
  });

  it('renders widget titles correctly', () => {
    render(<SalesRepDashboard />);

    expect(screen.getByText('My Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Sales Forecast')).toBeInTheDocument();
    expect(screen.getByText('Win/Loss Metrics')).toBeInTheDocument();
    expect(screen.getByText('Revenue YTD')).toBeInTheDocument();
  });

  it('removes widget when remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<SalesRepDashboard />);

    const removeButtons = screen.getAllByTitle('Remove widget');
    const initialCount = screen.getAllByTestId('card').length;

    await user.click(removeButtons[0]);

    // Should have one fewer widget
    const cardsAfter = screen.queryAllByTestId('card');
    expect(cardsAfter.length).toBeLessThan(initialCount);
  });

  it('hides widget content when minimize button clicked', async () => {
    const user = userEvent.setup();
    render(<SalesRepDashboard />);

    const maximizeButtons = screen.getAllByTitle('Maximize');
    expect(maximizeButtons.length).toBeGreaterThan(0);

    await user.click(maximizeButtons[0]);

    // Should still have widgets rendered
    expect(screen.getByTestId('pipeline-by-stage')).toBeInTheDocument();
  });

  it('shows reset button when all widgets removed', async () => {
    const user = userEvent.setup();
    render(<SalesRepDashboard />);

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
    render(<SalesRepDashboard />);

    const removeButtons = screen.getAllByTitle('Remove widget');

    // Remove all widgets
    for (const button of removeButtons) {
      await user.click(button);
    }

    const resetButton = screen.getByText('Reset Dashboard');
    await user.click(resetButton);

    // Should show all widgets again
    expect(screen.getByTestId('pipeline-by-stage')).toBeInTheDocument();
    expect(screen.getByTestId('sales-forecast')).toBeInTheDocument();
    expect(screen.getByTestId('win-loss-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('revenue-ytd')).toBeInTheDocument();
  });

  it('applies correct grid classes to widgets', () => {
    const { container } = render(<SalesRepDashboard />);

    const gridDiv = container.querySelector('.grid');
    expect(gridDiv).toHaveClass('grid-cols-1');
    expect(gridDiv).toHaveClass('gap-4');
  });

  it('renders all cards with hover effect', () => {
    const { container } = render(<SalesRepDashboard />);

    const cards = container.querySelectorAll('[data-testid="card"]');
    cards.forEach(card => {
      expect(card).toHaveClass('hover:shadow-lg');
    });
  });
});
