import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocationSelect } from '../LocationSelect';
import { vi } from 'vitest';

// Mock Supabase
const mockSelect = vi.fn();
const mockOr = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();

const mockSupabase = {
  from: vi.fn(() => ({
    select: mockSelect,
    insert: vi.fn(),
    update: vi.fn(),
  })),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('LocationSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup chainable mocks
    mockSelect.mockReturnValue({
      or: mockOr,
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      maybeSingle: mockMaybeSingle,
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
      { id: '1', location_name: 'Singapore', location_code: 'SGSIN', city: 'Singapore', country: 'Singapore' },
      { id: '2', location_name: 'Shanghai', location_code: 'CNSHA', city: 'Shanghai', country: 'China' },
    ];

    mockLimit.mockResolvedValue({ data: mockData, error: null });

    render(<LocationSelect onChange={() => {}} />);
    
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('ports_locations');
      // Verify initial fetch without search filter
      expect(mockSelect).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(20);
    });

    expect(screen.getByText(/Singapore/)).toBeInTheDocument();
    expect(screen.getByText(/Shanghai/)).toBeInTheDocument();
  });

  it('switches to search mode when typing', async () => {
    const defaultData = [
      { id: '1', location_name: 'Singapore', location_code: 'SGSIN', city: 'Singapore', country: 'Singapore' },
    ];
    const searchData = [
      { id: '3', location_name: 'Mumbai', location_code: 'INBOM', city: 'Mumbai', country: 'India' },
    ];

    // First call returns default data
    mockLimit.mockResolvedValueOnce({ data: defaultData, error: null });
    // Second call returns search data
    mockLimit.mockResolvedValueOnce({ data: searchData, error: null });

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
      expect(mockOr).toHaveBeenCalledWith(expect.stringContaining('Mumbai'));
      expect(screen.getByText(/Mumbai/)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('handles empty results with Create option', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    render(<LocationSelect onChange={() => {}} />);
    
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('No results.')).toBeInTheDocument();
      expect(screen.getByText('Create new location')).toBeInTheDocument();
    });
  });

  it('displays selected value correctly', async () => {
    const locationData = { 
      id: '1', 
      location_name: 'Singapore', 
      location_code: 'SGSIN', 
      city: 'Singapore', 
      country: 'Singapore' 
    };

    // Mock maybeSingle for fetchLocationDetails
    mockMaybeSingle.mockResolvedValue({ data: locationData, error: null });
    
    render(<LocationSelect value="Singapore" onChange={() => {}} />);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('ports_locations');
      expect(mockEq).toHaveBeenCalledWith('location_name', 'Singapore');
    });
    
    // Check if Edit/Delete buttons are present when value is selected
    expect(screen.getByRole('button', { name: /Edit Location/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Location/i })).toBeInTheDocument();
  });
});
