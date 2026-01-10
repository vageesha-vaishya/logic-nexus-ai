import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StatsCards, StatItem } from '../StatsCards';
import { Ship } from 'lucide-react';

// Mock translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (str: string) => str,
  }),
}));

// Mock Recharts to avoid ResizeObserver issues
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div className="recharts-responsive-container" style={{ width: 800, height: 800 }}>
        {children}
      </div>
    ),
    AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Area: () => <div data-testid="area-chart" />,
    Tooltip: () => null,
  };
});

describe('StatsCards', () => {
  const mockStats: StatItem[] = [
    {
      id: 'test-1',
      title: 'Test Metric',
      value: '100',
      change: '+10%',
      trend: 'up',
      icon: Ship,
      color: 'text-blue-500',
      data: [{ value: 10 }, { value: 20 }],
      description: 'Test Description',
    },
  ];

  it('renders stats correctly', () => {
    render(<StatsCards stats={mockStats} />);
    expect(screen.getByText('Test Metric')).toBeDefined();
    expect(screen.getByText('100')).toBeDefined();
    expect(screen.getByText('+10%')).toBeDefined();
  });

  it('renders loading state', () => {
    const { container } = render(<StatsCards loading={true} />);
    // Look for animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(4);
  });

  it('handles click interactions', () => {
    const onClick = vi.fn();
    const clickableStats = [
      {
        ...mockStats[0],
        onClick,
      },
    ];

    render(<StatsCards stats={clickableStats} />);
    // Use closest to find the card container which should have the click handler
    const title = screen.getByText('Test Metric');
    const card = title.closest('div.cursor-pointer'); 
    
    expect(card).toBeDefined();
    if (card) {
        fireEvent.click(card);
        expect(onClick).toHaveBeenCalled();
    }
  });
  
  it('renders default stats if none provided', () => {
    render(<StatsCards />);
    expect(screen.getByText('Active Shipments')).toBeDefined();
    expect(screen.getByText('Pipeline Velocity')).toBeDefined();
  });
});
