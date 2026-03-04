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

  it('should show results when typing 2 characters', async () => {
    render(<SmartCargoInput onSelect={mockOnSelect} />);

    // Mock successful response
    mockUseQuery.mockReturnValue({
      data: [{ id: '1', name: 'Apple', description: 'Fresh Apples' }],
      isLoading: false,
    });

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const input = screen.getByPlaceholderText('Type to search...');
    fireEvent.change(input, { target: { value: 'Ap' } });

    // Advance timers for debounce
    act(() => {
        vi.advanceTimersByTime(300);
    });

    // Should NOT show "Type at least 2 characters..."
    expect(screen.queryByText('Type at least 2 characters...')).not.toBeInTheDocument();
    
    // Should show results
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });
});
