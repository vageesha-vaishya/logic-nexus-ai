import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuoteManagerDashboard } from '../QuoteManagerDashboard';

// Mock all the widget components
vi.mock('../widgets/MyPendingQuotes', () => ({
  MyPendingQuotes: () => <div data-testid="my-pending-quotes">My Pending Quotes Widget</div>,
}));

vi.mock('../widgets/QuoteAccuracyTracker', () => ({
  QuoteAccuracyTracker: () => <div data-testid="quote-accuracy-tracker">Quote Accuracy Tracker Widget</div>,
}));

vi.mock('../widgets/QuotesByStatus', () => ({
  QuotesByStatus: () => <div data-testid="quotes-by-status">Quotes by Status Widget</div>,
}));

vi.mock('../widgets/QuickQuoteGenerator', () => ({
  QuickQuoteGenerator: () => <div data-testid="quick-quote-generator">Quick Quote Generator Widget</div>,
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

describe('QuoteManagerDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard title and description', () => {
    render(<QuoteManagerDashboard />);

    expect(screen.getByText('Quote Manager Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Track quotes, accuracy, and generate quick quotes')).toBeInTheDocument();
  });

  it('renders all default widgets', () => {
    render(<QuoteManagerDashboard />);

    expect(screen.getByTestId('my-pending-quotes')).toBeInTheDocument();
    expect(screen.getByTestId('quote-accuracy-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('quotes-by-status')).toBeInTheDocument();
    expect(screen.getByTestId('quick-quote-generator')).toBeInTheDocument();
  });

  it('renders widget titles correctly', () => {
    render(<QuoteManagerDashboard />);

    expect(screen.getByText('My Pending Quotes')).toBeInTheDocument();
    expect(screen.getByText('Quote Accuracy Tracker')).toBeInTheDocument();
    expect(screen.getByText('Quotes by Status')).toBeInTheDocument();
    expect(screen.getByText('Quick Quote Generator')).toBeInTheDocument();
  });

  it('removes widget when remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<QuoteManagerDashboard />);

    const removeButtons = screen.getAllByTitle('Remove widget');
    const initialCount = screen.getAllByTestId('card').length;

    await user.click(removeButtons[0]);

    const cardsAfter = screen.queryAllByTestId('card');
    expect(cardsAfter.length).toBeLessThan(initialCount);
  });

  it('toggles widget maximize/minimize on button click', async () => {
    const user = userEvent.setup();
    render(<QuoteManagerDashboard />);

    const maximizeButtons = screen.getAllByTitle('Maximize');
    expect(maximizeButtons.length).toBeGreaterThan(0);

    await user.click(maximizeButtons[0]);

    // Widget should still be present
    expect(screen.getByTestId('my-pending-quotes')).toBeInTheDocument();
  });

  it('shows reset button when all widgets removed', async () => {
    const user = userEvent.setup();
    render(<QuoteManagerDashboard />);

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
    render(<QuoteManagerDashboard />);

    const removeButtons = screen.getAllByTitle('Remove widget');

    // Remove all widgets
    for (const button of removeButtons) {
      await user.click(button);
    }

    const resetButton = screen.getByText('Reset Dashboard');
    await user.click(resetButton);

    // Should show all widgets again
    expect(screen.getByTestId('my-pending-quotes')).toBeInTheDocument();
    expect(screen.getByTestId('quote-accuracy-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('quotes-by-status')).toBeInTheDocument();
    expect(screen.getByTestId('quick-quote-generator')).toBeInTheDocument();
  });

  it('applies correct grid classes to widgets', () => {
    const { container } = render(<QuoteManagerDashboard />);

    const gridDiv = container.querySelector('.grid');
    expect(gridDiv).toHaveClass('grid-cols-1');
    expect(gridDiv).toHaveClass('gap-4');
  });

  it('renders all cards with hover effect', () => {
    const { container } = render(<QuoteManagerDashboard />);

    const cards = container.querySelectorAll('[data-testid="card"]');
    cards.forEach(card => {
      expect(card).toHaveClass('hover:shadow-lg');
    });
  });

  it('renders correct number of default widgets', () => {
    render(<QuoteManagerDashboard />);

    const cards = screen.getAllByTestId('card');
    expect(cards.length).toBe(4); // Four default widgets
  });

  it('handles multiple widget removals sequentially', async () => {
    const user = userEvent.setup();
    render(<QuoteManagerDashboard />);

    // Remove first widget
    let removeButtons = screen.getAllByTitle('Remove widget');
    await user.click(removeButtons[0]);
    expect(screen.getAllByTestId('card').length).toBe(3);

    // Remove second widget
    removeButtons = screen.getAllByTitle('Remove widget');
    await user.click(removeButtons[0]);
    expect(screen.getAllByTestId('card').length).toBe(2);

    // Remove third widget
    removeButtons = screen.getAllByTitle('Remove widget');
    await user.click(removeButtons[0]);
    expect(screen.getAllByTestId('card').length).toBe(1);
  });

  it('maintains proper widget count after toggle operations', async () => {
    const user = userEvent.setup();
    render(<QuoteManagerDashboard />);

    const initialCount = screen.getAllByTestId('card').length;

    // Toggle maximize multiple times
    let maximizeButtons = screen.getAllByTitle('Maximize');
    await user.click(maximizeButtons[0]);

    maximizeButtons = screen.queryAllByTitle('Minimize');
    if (maximizeButtons.length > 0) {
      await user.click(maximizeButtons[0]);
    }

    // Count should remain the same
    expect(screen.getAllByTestId('card').length).toBe(initialCount);
  });
});
