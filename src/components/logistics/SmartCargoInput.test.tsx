import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmartCargoInput } from './SmartCargoInput';
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// Mock useCRM
const mockScopedDb = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      or: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    // For fallback search
    or: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  })),
  rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb
  })
}));

// Mock useQuery
const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => mockUseQuery(options)
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, onFocus, onKeyDown, onPaste, role }: any) => (
    <button 
      onClick={onClick} 
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      role={role}
      data-testid={role === 'combobox' ? 'smart-input-trigger' : 'other-button'}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children, open }: any) => <div data-testid="popover-root" data-open={open}>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}));

vi.mock('@/components/ui/command', async () => {
  const React = await import('react');
  return {
    Command: ({ children }: any) => <div data-testid="command-root">{children}</div>,
    CommandInput: React.forwardRef(({ value, onValueChange, placeholder }: any, ref: any) => (
      <input 
        ref={ref}
        data-testid="command-input"
        value={value} 
        onChange={e => onValueChange(e.target.value)}
        placeholder={placeholder}
      />
    )),
    CommandList: ({ children }: any) => <div data-testid="command-list">{children}</div>,
    CommandEmpty: ({ children }: any) => <div data-testid="command-empty">{children}</div>,
    CommandGroup: ({ children, heading }: any) => (
      <div data-testid="command-group" title={heading}>
        <h3>{heading}</h3>
        {children}
      </div>
    ),
    CommandItem: ({ children, onSelect }: any) => (
      <div data-testid="command-item" onClick={onSelect}>
        {children}
      </div>
    ),
    CommandSeparator: () => <div data-testid="command-separator" />,
  };
});

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    Check: () => <div />,
    ChevronsUpDown: () => <div />,
    Search: () => <div />,
    Package: () => <div />,
    AlertCircle: () => <div />,
    FolderSearch: () => <div />,
  };
});

describe('SmartCargoInput', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should sync internal state when value prop changes', () => {
    const { rerender } = render(<SmartCargoInput onSelect={mockOnSelect} value="Initial" />);
    
    // Initial render
    expect(screen.getByRole('combobox')).toHaveTextContent('Initial');

    // Update prop
    rerender(<SmartCargoInput onSelect={mockOnSelect} value="Updated" />);
    
    expect(screen.getByRole('combobox')).toHaveTextContent('Updated');
  });

  it('should allow creating a custom commodity', async () => {
    render(<SmartCargoInput onSelect={mockOnSelect} />);
    
    // Mock empty results
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText('Type to search...');
    fireEvent.change(input, { target: { value: 'New Item' } });

    // Advance timers for debounce
    act(() => {
        vi.advanceTimersByTime(300);
    });

    // Look for custom option
    const customOption = screen.getByText('Use "New Item"');
    expect(customOption).toBeInTheDocument();

    fireEvent.click(customOption);

    expect(mockOnSelect).toHaveBeenCalledWith({ description: 'New Item' });
  });

  it('should handle API errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<SmartCargoInput onSelect={mockOnSelect} />);
    
    // Mock error response
    mockUseQuery.mockReturnValue({
      data: undefined,
      error: new Error('Network Error'),
      isError: true,
      isLoading: false,
    });

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText('Type to search...');
    fireEvent.change(input, { target: { value: 'Error' } });

    // Advance timers
    act(() => {
        vi.advanceTimersByTime(300);
    });

    // Should not crash, should show empty state or fallback
    // In current implementation, it shows "No results found" (CommandEmpty) if data is undefined/empty
    // We can check if it rendered safely
    expect(screen.getByText('Search encountered an issue. You can still use a custom description.')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('should not show error banner when only one source errors', async () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: undefined,
        error: new Error('Master Error'),
        isError: true,
        isFetching: false,
        isLoading: false,
      })
      .mockReturnValueOnce({
        data: [],
        isError: false,
        isFetching: false,
        isLoading: false,
      });

    render(<SmartCargoInput onSelect={mockOnSelect} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText('Type to search...');
    fireEvent.change(input, { target: { value: 'ba' } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Search encountered an issue. You can still use a custom description.')).toBeNull();
  });
});
