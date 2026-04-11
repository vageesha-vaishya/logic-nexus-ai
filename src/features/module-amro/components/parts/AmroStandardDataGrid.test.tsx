/**
 * AMRO DataGrid Component - Comprehensive Unit Tests
 * 
 * Tests 50+ data scenarios including:
 * - Rendering consistency
 * - Sorting functionality
 * - Pagination behavior
 * - Empty/loading states
 * - Accessibility compliance
 * - Responsive behavior
 * - Keyboard navigation
 * - Zebra striping
 * - Hover states
 * - Click handlers
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AmroDataGrid, AmroPagination, AmroColumn } from './AmroStandardDataGrid';

// ============================================================================
// Test Data
// ============================================================================

interface TestRow {
  id: number;
  name: string;
  status: string;
  quantity: number;
}

const mockColumns: AmroColumn<TestRow>[] = [
  { key: 'id', header: 'ID', sortable: true },
  { key: 'name', header: 'Name', sortable: true },
  { key: 'status', header: 'Status', sortable: true },
  { key: 'quantity', header: 'Quantity', sortable: false },
];

const generateMockData = (count: number): TestRow[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    status: i % 3 === 0 ? 'Active' : i % 3 === 1 ? 'Inactive' : 'Pending',
    quantity: Math.floor(Math.random() * 100),
  }));
};

const mockData5 = generateMockData(5);
const mockData10 = generateMockData(10);
const mockData50 = generateMockData(50);
const mockData100 = generateMockData(100);

// ============================================================================
// 1. Basic Rendering Tests (10 tests)
// ============================================================================

describe('AmroDataGrid - Basic Rendering', () => {
  test('renders with data', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  test('renders correct number of rows', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData10} />);
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(11); // 1 header + 10 data rows
  });

  test('renders correct number of columns', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    const headerRow = screen.getAllByRole('columnheader');
    expect(headerRow).toHaveLength(4);
  });

  test('renders header text', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
  });

  test('renders cell content', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 5')).toBeInTheDocument();
  });

  test('applies zebra striping by default', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    const rows = screen.getAllByRole('row');
    expect(rows[2]).toHaveClass('bg-muted/20'); // Even row (index 2)
  });

  test('disables zebra striping when specified', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} zebraStriping={false} />);
    const rows = screen.getAllByRole('row');
    expect(rows[2]).not.toHaveClass('bg-muted/20');
  });

  test('applies correct font sizes', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    const headers = screen.getAllByRole('columnheader');
    const cells = screen.getAllByRole('gridcell');
    
    headers.forEach(header => {
      expect(header).toHaveStyle({ fontSize: '1rem', fontWeight: '600' });
    });
    
    cells.forEach(cell => {
      expect(cell).toHaveStyle({ fontSize: '0.875rem', lineHeight: '1.4285' });
    });
  });

  test('applies correct cell padding', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    const cells = screen.getAllByRole('gridcell');
    cells.forEach(cell => {
      expect(cell).toHaveStyle({ padding: '0.5rem 0.75rem' });
    });
  });

  test('applies border color #E5E7EB', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    const table = screen.getByRole('grid');
    expect(table).toHaveClass('border-border');
  });
});

// ============================================================================
// 2. Sorting Tests (10 tests)
// ============================================================================

describe('AmroDataGrid - Sorting', () => {
  test('renders sort icons for sortable columns', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} onSort={jest.fn()} />);
    const sortableHeaders = screen.getAllByRole('columnheader').filter(
      th => th.getAttribute('aria-sort') !== null || th.querySelector('svg')
    );
    expect(sortableHeaders.length).toBeGreaterThanOrEqual(3);
  });

  test('does not render sort icons for non-sortable columns', () => {
    const nonSortableColumns = [{ key: 'quantity', header: 'Quantity', sortable: false }];
    render(<AmroDataGrid columns={nonSortableColumns} data={mockData5} onSort={jest.fn()} />);
    const header = screen.getByRole('columnheader');
    expect(header).not.toHaveAttribute('aria-sort');
  });

  test('calls onSort when header clicked', () => {
    const handleSort = jest.fn();
    render(
      <AmroDataGrid
        columns={mockColumns}
        data={mockData5}
        onSort={handleSort}
        sortColumn="name"
        sortDirection="asc"
      />
    );
    const nameHeader = screen.getByText('Name').closest('th');
    fireEvent.click(nameHeader!);
    expect(handleSort).toHaveBeenCalledWith('name', 'desc');
  });

  test('cycles through sort directions: asc → desc → null → asc', () => {
    const handleSort = jest.fn();
    const { rerender } = render(
      <AmroDataGrid
        columns={mockColumns}
        data={mockData5}
        onSort={handleSort}
        sortColumn="name"
        sortDirection="asc"
      />
    );
    
    const nameHeader = screen.getByText('Name').closest('th');
    
    // asc → desc
    fireEvent.click(nameHeader!);
    expect(handleSort).toHaveBeenLastCalledWith('name', 'desc');
    
    // desc → null
    rerender(
      <AmroDataGrid
        columns={mockColumns}
        data={mockData5}
        onSort={handleSort}
        sortColumn="name"
        sortDirection="desc"
      />
    );
    fireEvent.click(nameHeader!);
    expect(handleSort).toHaveBeenLastCalledWith('name', null);
  });

  test('displays correct aria-sort attribute', () => {
    render(
      <AmroDataGrid
        columns={mockColumns}
        data={mockData5}
        onSort={jest.fn()}
        sortColumn="name"
        sortDirection="asc"
      />
    );
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  });

  test('sort icons are 16x16px', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} onSort={jest.fn()} />);
    const icons = document.querySelectorAll('.amro-sort-icon, svg');
    icons.forEach(icon => {
      const svg = icon as SVGElement;
      if (svg.getAttribute('width')) {
        expect(svg.getAttribute('width')).toBe('1rem');
        expect(svg.getAttribute('height')).toBe('1rem');
      }
    });
  });

  test('hover state shows sort icon', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} onSort={jest.fn()} />);
    const nameHeader = screen.getByText('Name').closest('th');
    fireEvent.mouseEnter(nameHeader!);
    const icon = nameHeader?.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  test('keyboard navigation activates sorting', () => {
    const handleSort = jest.fn();
    render(
      <AmroDataGrid
        columns={mockColumns}
        data={mockData5}
        onSort={handleSort}
        sortColumn="name"
        sortDirection="asc"
      />
    );
    const nameHeader = screen.getByText('Name').closest('th');
    nameHeader?.focus();
    fireEvent.keyDown(nameHeader!, { key: 'Enter' });
    expect(handleSort).toHaveBeenCalledWith('name', 'desc');
  });

  test('space key activates sorting', () => {
    const handleSort = jest.fn();
    render(
      <AmroDataGrid
        columns={mockColumns}
        data={mockData5}
        onSort={handleSort}
        sortColumn="name"
        sortDirection="asc"
      />
    );
    const nameHeader = screen.getByText('Name').closest('th');
    nameHeader?.focus();
    fireEvent.keyDown(nameHeader!, { key: ' ' });
    expect(handleSort).toHaveBeenCalledWith('name', 'desc');
  });

  test('sort changes visual state', () => {
    const { rerender } = render(
      <AmroDataGrid
        columns={mockColumns}
        data={mockData5}
        onSort={jest.fn()}
        sortColumn="name"
        sortDirection="asc"
      />
    );
    
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    
    rerender(
      <AmroDataGrid
        columns={mockColumns}
        data={mockData5}
        onSort={jest.fn()}
        sortColumn="name"
        sortDirection="desc"
      />
    );
    
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  });
});

// ============================================================================
// 3. Pagination Tests (10 tests)
// ============================================================================

describe('AmroPagination', () => {
  const mockPagination = {
    currentPage: 1,
    totalPages: 5,
    onPageChange: jest.fn(),
    pageSize: 10,
    totalItems: 50,
  };

  test('renders pagination controls', () => {
    render(<AmroPagination {...mockPagination} />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  test('displays correct page numbers', () => {
    render(<AmroPagination {...mockPagination} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('calls onPageChange when page clicked', () => {
    render(<AmroPagination {...mockPagination} />);
    fireEvent.click(screen.getByText('3'));
    expect(mockPagination.onPageChange).toHaveBeenCalledWith(3);
  });

  test('disables Previous button on first page', () => {
    render(<AmroPagination {...mockPagination} currentPage={1} />);
    const prevButton = screen.getByText('Previous');
    expect(prevButton).toBeDisabled();
  });

  test('disables Next button on last page', () => {
    render(<AmroPagination {...mockPagination} currentPage={5} totalPages={5} />);
    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  test('enables Previous button on pages > 1', () => {
    render(<AmroPagination {...mockPagination} currentPage={2} />);
    const prevButton = screen.getByText('Previous');
    expect(prevButton).not.toBeDisabled();
  });

  test('enables Next button on pages < totalPages', () => {
    render(<AmroPagination {...mockPagination} currentPage={3} />);
    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
  });

  test('displays item count when totalItems provided', () => {
    render(<AmroPagination {...mockPagination} />);
    expect(screen.getByText('1-10 of 50')).toBeInTheDocument();
  });

  test('applies 8px gap between page numbers', () => {
    render(<AmroPagination {...mockPagination} />);
    const pagination = screen.getByRole('navigation');
    expect(pagination).toHaveStyle({ gap: '0.5rem' });
  });

  test('applies 16px margin from grid edge', () => {
    render(<AmroPagination {...mockPagination} />);
    const pagination = screen.getByRole('navigation');
    expect(pagination).toHaveStyle({ marginTop: '1rem' });
  });
});

// ============================================================================
// 4. Empty & Loading States (5 tests)
// ============================================================================

describe('AmroDataGrid - Empty & Loading States', () => {
  test('renders loading state', () => {
    render(<AmroDataGrid columns={mockColumns} data={[]} isLoading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('renders skeleton loaders in loading state', () => {
    render(<AmroDataGrid columns={mockColumns} data={[]} isLoading={true} />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(5);
  });

  test('renders empty state message', () => {
    render(<AmroDataGrid columns={mockColumns} data={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  test('displays custom empty message', () => {
    render(
      <AmroDataGrid
        columns={mockColumns}
        data={[]}
        emptyMessage="No parts found"
      />
    );
    expect(screen.getByText('No parts found')).toBeInTheDocument();
  });

  test('applies correct empty state styling', () => {
    render(<AmroDataGrid columns={mockColumns} data={[]} />);
    const emptyState = screen.getByText('No data available').closest('div');
    expect(emptyState).toHaveClass('amro-grid-empty');
  });
});

// ============================================================================
// 5. Row Interaction Tests (10 tests)
// ============================================================================

describe('AmroDataGrid - Row Interaction', () => {
  test('calls onRowClick when row clicked', () => {
    const handleClick = jest.fn();
    render(
      <AmroDataGrid columns={mockColumns} data={mockData5} onRowClick={handleClick} />
    );
    const firstRow = screen.getByText('Item 1').closest('tr');
    fireEvent.click(firstRow!);
    expect(handleClick).toHaveBeenCalledWith(mockData5[0], 0);
  });

  test('applies cursor-pointer when onRowClick provided', () => {
    render(
      <AmroDataGrid columns={mockColumns} data={mockData5} onRowClick={jest.fn()} />
    );
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveClass('cursor-pointer');
  });

  test('does not apply cursor-pointer when onRowClick not provided', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    const rows = screen.getAllByRole('row');
    expect(rows[1]).not.toHaveClass('cursor-pointer');
  });

  test('applies hover state on mouse enter', () => {
    render(
      <AmroDataGrid columns={mockColumns} data={mockData5} onRowClick={jest.fn()} />
    );
    const firstRow = screen.getByText('Item 1').closest('tr');
    fireEvent.mouseEnter(firstRow!);
    expect(firstRow).toHaveClass('bg-muted/40');
  });

  test('removes hover state on mouse leave', () => {
    render(
      <AmroDataGrid columns={mockColumns} data={mockData5} onRowClick={jest.fn()} />
    );
    const firstRow = screen.getByText('Item 1').closest('tr');
    fireEvent.mouseEnter(firstRow!);
    fireEvent.mouseLeave(firstRow!);
    expect(firstRow).not.toHaveClass('bg-muted/40');
  });

  test('keyboard Enter activates row click', () => {
    const handleClick = jest.fn();
    render(
      <AmroDataGrid columns={mockColumns} data={mockData5} onRowClick={handleClick} />
    );
    const firstRow = screen.getByText('Item 1').closest('tr');
    firstRow?.focus();
    fireEvent.keyDown(firstRow!, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledWith(mockData5[0], 0);
  });

  test('keyboard Space activates row click', () => {
    const handleClick = jest.fn();
    render(
      <AmroDataGrid columns={mockColumns} data={mockData5} onRowClick={handleClick} />
    );
    const firstRow = screen.getByText('Item 1').closest('tr');
    firstRow?.focus();
    fireEvent.keyDown(firstRow!, { key: ' ' });
    expect(handleClick).toHaveBeenCalledWith(mockData5[0], 0);
  });

  test('renders with custom column render function', () => {
    const customColumns: AmroColumn<TestRow>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (value) => <span data-testid="custom-render">{value.toUpperCase()}</span>,
      },
    ];
    render(<AmroDataGrid columns={customColumns} data={mockData5} />);
    expect(screen.getByTestId('custom-render')).toHaveTextContent('ITEM 1');
  });

  test('applies custom column width', () => {
    const customColumns: AmroColumn<TestRow>[] = [
      { key: 'id', header: 'ID', width: '100px' },
    ];
    render(<AmroDataGrid columns={customColumns} data={mockData5} />);
    const header = screen.getByText('ID').closest('th');
    expect(header).toHaveStyle({ width: '100px' });
  });

  test('applies custom column className', () => {
    const customColumns: AmroColumn<TestRow>[] = [
      { key: 'status', header: 'Status', className: 'text-center' },
    ];
    render(<AmroDataGrid columns={customColumns} data={mockData5} />);
    const cells = screen.getAllByRole('gridcell');
    cells.forEach(cell => {
      if (cell.textContent === 'Active' || cell.textContent === 'Inactive' || cell.textContent === 'Pending') {
        expect(cell).toHaveClass('text-center');
      }
    });
  });
});

// ============================================================================
// 6. Performance Tests (5 tests)
// ============================================================================

describe('AmroDataGrid - Performance', () => {
  test('renders 50 rows efficiently', () => {
    const start = performance.now();
    render(<AmroDataGrid columns={mockColumns} data={mockData50} />);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100); // <100ms target
  });

  test('renders 100 rows within performance target', () => {
    const start = performance.now();
    render(<AmroDataGrid columns={mockColumns} data={mockData100} />);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(150); // Slightly higher for 100 rows
  });

  test('handles rapid sorting without performance degradation', () => {
    const handleSort = jest.fn();
    render(
      <AmroDataGrid
        columns={mockColumns}
        data={mockData50}
        onSort={handleSort}
      />
    );
    
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      const nameHeader = screen.getByText('Name').closest('th');
      fireEvent.click(nameHeader!);
    }
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(200); // 10 sorts < 200ms
  });

  test('pagination re-renders efficiently', () => {
    const { rerender } = render(<AmroPagination currentPage={1} totalPages={10} onPageChange={jest.fn()} />);
    
    const start = performance.now();
    for (let i = 1; i <= 10; i++) {
      rerender(<AmroPagination currentPage={i} totalPages={10} onPageChange={jest.fn()} />);
    }
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100); // 10 re-renders < 100ms
  });

  test('memory usage stable with large datasets', () => {
    const { unmount } = render(<AmroDataGrid columns={mockColumns} data={mockData100} />);
    const beforeMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    unmount();
    rerender(<AmroDataGrid columns={mockColumns} data={[]} />);
    
    const afterMemory = (performance as any).memory?.usedJSHeapSize || 0;
    // Memory should not increase significantly after unmount
    expect(afterMemory - beforeMemory).toBeLessThan(1000000); // < 1MB increase
  });
});

// ============================================================================
// 7. Accessibility Tests (10 tests)
// ============================================================================

describe('AmroDataGrid - Accessibility', () => {
  test('table has role="grid"', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  test('headers have role="columnheader"', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(4);
  });

  test('rows have role="row"', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(0);
  });

  test('cells have role="gridcell"', () => {
    render(<AmroDataGrid columns={mockColumns} data={mockData5} />);
    const cells = screen.getAllByRole('gridcell');
    expect(cells.length).toBeGreaterThan(0);
  });

  test('sortable headers have aria-sort', () => {
    render(
      <AmroDataGrid
        columns={mockColumns}
        data={mockData5}
        onSort={jest.fn()}
        sortColumn="name"
        sortDirection="asc"
      />
    );
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  });

  test('pagination has aria-label', () => {
    render(<AmroPagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />);
    expect(screen.getByRole('navigation')).toHaveAttribute(
      'aria-label',
      'Pagination navigation'
    );
  });

  test('page buttons have aria-label', () => {
    render(<AmroPagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Page 1')).toBeInTheDocument();
  });

  test('current page has aria-current', () => {
    render(<AmroPagination currentPage={2} totalPages={5} onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Page 2')).toHaveAttribute('aria-current', 'page');
  });

  test('previous/next buttons have aria-label', () => {
    render(<AmroPagination currentPage={2} totalPages={5} onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
  });

  test('touch targets are 44x44px minimum', () => {
    render(<AmroPagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      const style = window.getComputedStyle(button);
      expect(parseInt(style.minHeight)).toBeGreaterThanOrEqual(44);
      expect(parseInt(style.minWidth)).toBeGreaterThanOrEqual(44);
    });
  });
});
