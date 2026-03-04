import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocationSelect } from '../LocationSelect';
import { vi } from 'vitest';

import { useCRM } from '@/hooks/useCRM';

// Mock useCRM
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

// Mock Supabase chain
const mockSelect = vi.fn();
const mockOr = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn();
const mockRpc = vi.fn();

const mockScopedDb = {
  from: vi.fn(() => ({
    select: mockSelect,
    insert: vi.fn(),
    update: mockUpdate,
  })),
  rpc: mockRpc,
};

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('LocationSelect', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    
    // Setup useCRM mock
    (useCRM as any).mockReturnValue({
      scopedDb: mockScopedDb,
    });
    
    // Setup chainable mocks
    mockSelect.mockReturnValue({
      or: mockOr,
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      maybeSingle: mockMaybeSingle,
    });

    mockUpdate.mockReturnValue({
        eq: mockEq,
    });
    
    mockOr.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
    });
    
    mockEq.mockReturnValue({
      order: mockOrder,
      limit: mockLimit,
      maybeSingle: mockMaybeSingle,
      // For delete/update chains
      then: vi.fn().mockImplementation((cb) => cb({ error: null })), 
    });

    mockOrder.mockReturnValue({
      limit: mockLimit,
    });
  });


  it('renders placeholder initially', () => {
    render(<LocationSelect onChange={() => {}} />);
    expect(screen.getByText('Select city/port...')).toBeInTheDocument();
  });

  it('fetches default locations on open', async () => {
    const mockData = [
      { id: '1', name: 'Singapore', code: 'SGSIN', city_name: 'Singapore', country_name: 'Singapore', type: 'port' },
      { id: '2', name: 'Shanghai', code: 'CNSHA', city_name: 'Shanghai', country_name: 'China', type: 'port' },
    ];

    mockRpc.mockResolvedValue({ data: mockData, error: null });

    render(<LocationSelect onChange={() => {}} />);
    
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockScopedDb.rpc).toHaveBeenCalledWith('search_locations', {
        search_text: '',
        limit_count: 20
      });
      // Verify initial fetch without search filter
    });

    expect(screen.getByText(/Singapore/)).toBeInTheDocument();
    expect(screen.getByText(/Shanghai/)).toBeInTheDocument();
  });

  it('switches to search mode when typing', async () => {
    const defaultData = [
      { id: '1', name: 'Singapore', code: 'SGSIN', city_name: 'Singapore', country_name: 'Singapore', type: 'port' },
    ];
    const searchData = [
      { id: '3', name: 'Mumbai', code: 'INBOM', city_name: 'Mumbai', country_name: 'India', type: 'port' },
    ];

    // First call returns default data
    mockRpc.mockResolvedValueOnce({ data: defaultData, error: null });
    // Second call returns search data
    mockRpc.mockResolvedValueOnce({ data: searchData, error: null });

    render(<LocationSelect onChange={() => {}} />);
    
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Initial load
    await waitFor(() => {
      expect(screen.getByText(/Singapore/)).toBeInTheDocument();
    });

    // Type search term
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'Mumbai' } });

    // Wait for debounce and search
    await waitFor(() => {
      expect(mockScopedDb.rpc).toHaveBeenCalledWith('search_locations', {
        search_text: 'Mumbai',
        limit_count: 20
      });
      expect(screen.getByText(/Mumbai/)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('handles empty results with Create option', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    render(<LocationSelect onChange={() => {}} />);
    
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      // AsyncCombobox usually shows "No results." when empty, but might depend on implementation
      // Checking for Create option is safer
      expect(screen.getByText('Create new location')).toBeInTheDocument();
    });
  });

  it('displays selected value correctly', async () => {
    const locationData = [{ 
      id: '1', 
      name: 'Singapore', 
      code: 'SGSIN', 
      city_name: 'Singapore', 
      country_name: 'Singapore',
      type: 'port'
    }];

    // Mock rpc for fetchLocationDetails
    mockRpc.mockResolvedValue({ data: locationData, error: null });
    
    render(<LocationSelect value="Singapore" onChange={() => {}} />);

    await waitFor(() => {
      expect(mockScopedDb.rpc).toHaveBeenCalledWith('search_locations', {
        search_text: 'Singapore',
        limit_count: 1
      });
    });
    
    // Check if Edit/Delete buttons are present when value is selected
    expect(screen.getByRole('button', { name: /Edit Location/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Location/i })).toBeInTheDocument();
  });
});
