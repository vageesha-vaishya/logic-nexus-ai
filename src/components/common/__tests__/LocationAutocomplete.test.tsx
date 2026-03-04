import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocationAutocomplete } from '../LocationAutocomplete';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

const { mockSupabase, createMockChain, mockUser } = vi.hoisted(() => {
    const mockRpc = vi.fn();
    const mockFrom = vi.fn();

    const mockDb = {
        rpc: mockRpc,
        from: mockFrom
    };

    const createMockChain = () => {
        const range = vi.fn().mockResolvedValue({ data: [], error: null });
        const order = vi.fn().mockReturnValue({ range });
        
        const limit = vi.fn().mockResolvedValue({ data: [], error: null });
        const or = vi.fn().mockReturnValue({ limit });
        
        const single = vi.fn().mockResolvedValue({ data: null, error: null });
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const inFn = vi.fn().mockReturnValue({ single, maybeSingle });

        const select = vi.fn().mockReturnValue({
            order,
            or,
            in: inFn
        });

        return {
            select,
            mocks: { range, order, limit, or, single, maybeSingle, in: inFn }
        };
    };

    // Setup default behaviors using a fresh chain
    mockFrom.mockImplementation(() => createMockChain());

    const mockUser = { id: 'test-user-id' };

    return { mockSupabase: mockDb, createMockChain, mockUser };
});

vi.mock('@/hooks/useCRM', () => ({
    useCRM: () => ({
        supabase: mockSupabase,
        scopedDb: mockSupabase,
        user: mockUser
    })
}));

// Mock useDebounce since it involves timers
vi.mock('@/hooks/useDebounce', () => ({
    useDebounce: (value: any) => value
}));

// Mock ResizeObserver for Radix UI
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('LocationAutocomplete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.rpc.mockResolvedValue({
            data: [
                {
                    id: '1',
                    location_name: 'Los Angeles Port',
                    location_code: 'USLAX',
                    location_type: 'Port',
                    country: 'USA',
                    city: 'Los Angeles',
                    rank: 0.9
                },
                {
                    id: '2',
                    location_name: 'JFK Airport',
                    location_code: 'USJFK',
                    location_type: 'Airport',
                    country: 'USA',
                    city: 'New York',
                    rank: 0.8
                }
            ],
            error: null
        });
        // Reset from implementation to default
        mockSupabase.from.mockImplementation(() => createMockChain());
    });

    it('renders trigger with placeholder', () => {
        render(<LocationAutocomplete placeholder="Custom Placeholder" onChange={() => {}} />);
        expect(screen.getByRole('combobox')).toHaveTextContent('Custom Placeholder');
    });

    it('queries locations on input change via RPC', async () => {
        render(<LocationAutocomplete onChange={() => {}} />);
        
        // Open popover
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);

        // Find input inside popover
        const input = screen.getByPlaceholderText('Search port, airport, city...');
        fireEvent.change(input, { target: { value: 'Los' } });

        // Since useDebounce is mocked to return value immediately, the effect should run
        await waitFor(() => {
            expect(mockSupabase.rpc).toHaveBeenCalledWith('search_locations', { 
                search_text: 'Los', 
                limit_count: 10 
            });
        });
    });

    it('displays search results', async () => {
        render(<LocationAutocomplete onChange={() => {}} />);
        
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);

        const input = screen.getByPlaceholderText('Search port, airport, city...');
        fireEvent.change(input, { target: { value: 'Los' } });

        await waitFor(() => {
            expect(screen.getByText('Los Angeles Port')).toBeInTheDocument();
            expect(screen.getByText('JFK Airport')).toBeInTheDocument();
        });
    });

    it('shows “ID verified” hint when a result has a database ID', async () => {
        render(<LocationAutocomplete onChange={() => {}} />);
        
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);

        const input = screen.getByPlaceholderText('Search port, airport, city...');
        fireEvent.change(input, { target: { value: 'Los' } });

        await waitFor(() => {
            expect(screen.getByText('Los Angeles Port')).toBeInTheDocument();
        });

        expect(screen.getAllByText('ID verified').length).toBeGreaterThan(0);
    });

    it('calls onChange when a location is selected', async () => {
        const handleChange = vi.fn();
        render(<LocationAutocomplete onChange={handleChange} />);
        
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);

        const input = screen.getByPlaceholderText('Search port, airport, city...');
        fireEvent.change(input, { target: { value: 'Los' } });

        await waitFor(() => {
            expect(screen.getByText('Los Angeles Port')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Los Angeles Port'));
        
        expect(handleChange).toHaveBeenCalledWith(
            'Los Angeles Port',
            expect.objectContaining({
                location_name: 'Los Angeles Port',
                location_code: 'USLAX'
            })
        );
    });
    
    it('handles database errors gracefully', async () => {
        // Override mock for error
        mockSupabase.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: 'Database connection error' }
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<LocationAutocomplete onChange={() => {}} />);
        
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);

        const input = screen.getByPlaceholderText('Search port, airport, city...');
        fireEvent.change(input, { target: { value: 'Error' } });
        
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
        });
        
        consoleSpy.mockRestore();
    });

    it('uses preloadedLocations when provided and filters correctly', async () => {
        const preloaded = [
            {
                id: 'pre-1',
                location_name: 'Delhi Air Cargo',
                location_code: 'DEL',
                location_type: 'Airport',
                country: 'India',
                city: 'Delhi'
            },
            {
                id: 'pre-2',
                location_name: 'Mumbai Port',
                location_code: 'BOM',
                location_type: 'Port',
                country: 'India',
                city: 'Mumbai'
            }
        ];
        
        render(<LocationAutocomplete onChange={() => {}} preloadedLocations={preloaded} />);
        
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);
        
        // Should show preloaded options immediately without typing
        await waitFor(() => {
            expect(screen.getByText('Delhi Air Cargo')).toBeInTheDocument();
            expect(screen.getByText('Mumbai Port')).toBeInTheDocument();
        });

        // Test filtering
        const input = screen.getByPlaceholderText('Search port, airport, city...');
        fireEvent.change(input, { target: { value: 'Del' } });
        
        await waitFor(() => {
            expect(screen.getByText('Delhi Air Cargo')).toBeInTheDocument();
            expect(screen.queryByText('Mumbai Port')).not.toBeInTheDocument();
        });
        
        // Should NOT call RPC
        expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('searches RPC/DB when preloadedLocations has no matches', async () => {
        const preloaded = [
            { id: '1', location_name: 'Delhi', location_code: 'DEL', city: 'Delhi', country: 'IN', location_type: 'Airport' }
        ];
        
        // Mock RPC to return something
        mockSupabase.rpc.mockResolvedValue({
            data: [{ id: '99', location_name: 'New York', location_code: 'NYC', city: 'New York', country: 'US', location_type: 'Port' }],
            error: null
        });

        render(<LocationAutocomplete onChange={() => {}} preloadedLocations={preloaded} />);
        
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);
        
        const input = screen.getByPlaceholderText('Search port, airport, city...');
        fireEvent.change(input, { target: { value: 'New' } });
        
        await waitFor(() => {
            expect(mockSupabase.rpc).toHaveBeenCalled();
            expect(screen.getByText('New York')).toBeInTheDocument();
        });
    });

    it('preserves selection when value prop update lags behind local selection', async () => {
        const handleChange = vi.fn();
        const { rerender } = render(<LocationAutocomplete onChange={handleChange} value="" />);
        
        // Mock RPC for "New York"
        mockSupabase.rpc.mockResolvedValue({
            data: [{ id: '99', location_name: 'New York', location_code: 'NYC', city: 'New York', country: 'US', location_type: 'Port' }],
            error: null
        });

        // Search and Select
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);
        const input = screen.getByPlaceholderText('Search port, airport, city...');
        fireEvent.change(input, { target: { value: 'New' } });
        
        const item = await screen.findByText('New York');
        fireEvent.click(item);
        
        // Verify selection logic
        expect(handleChange).toHaveBeenCalledWith('New York', expect.anything());
        
        // At this point, value is still "" (prop hasn't updated).
        // Component state `selectedLocation` is set.
        // It should NOT be cleared by the effect.
        
        // Rerender with updated value
        rerender(<LocationAutocomplete onChange={handleChange} value="New York" />);
        
        // It should display formatted value (New York (NYC)) because it still has the object
        expect(trigger).toHaveTextContent('NYC');
    });

    it('displays value text even if location object is not in preloaded list', () => {
        render(<LocationAutocomplete onChange={() => {}} value="Ghost Town" />);
        const trigger = screen.getByRole('combobox');
        expect(trigger).toHaveTextContent('Ghost Town');
    });

    it('falls back to ports_locations when RPC returns empty', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({
            data: [],
            error: null
        });

        // Use createMockChain to create a chain that supports everything
        const chain = createMockChain();
        // Configure the fallback behavior (search)
        chain.mocks.limit.mockResolvedValue({
            data: [
                { id: 'p1', location_name: 'Fallback Port', location_code: 'FB001', location_type: 'seaport', country: 'US', city: 'Fallback' }
            ],
            error: null
        });
        
        // Use mockImplementation to return our configured chain
        // This ensures subsequent calls (like initialLoad) also get a valid chain
        // (though ideally initialLoad uses .order, which is also supported by default in chain)
        mockSupabase.from.mockImplementation(() => chain);

        render(<LocationAutocomplete onChange={() => {}} />);
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);
        const input = screen.getByPlaceholderText('Search port, airport, city...');
        fireEvent.change(input, { target: { value: 'Fall' } });

        await waitFor(() => {
            expect(screen.getByText(/Fallback Port/)).toBeInTheDocument();
        });
    });

    it('shows friendly message when no locations found', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({
            data: [],
            error: null
        });
        
        const chain = createMockChain();
        chain.mocks.limit.mockResolvedValue({
            data: [],
            error: null
        });
        mockSupabase.from.mockImplementation(() => chain);

        render(<LocationAutocomplete onChange={() => {}} />);
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);
        const input = screen.getByPlaceholderText('Search port, airport, city...');
        fireEvent.change(input, { target: { value: 'UnknownPlace' } });

        await waitFor(() => {
            expect(screen.getByText(/No locations found./)).toBeInTheDocument();
        });
    });

    it('loads initial ports list on open and supports Load more', async () => {
        // Mock initial list
        const initialList = Array.from({ length: 50 }).map((_, i) => ({
            id: `p${i+1}`,
            location_name: `Port ${i+1}`,
            location_code: `P${i+1}`,
            location_type: 'seaport',
            country: 'US',
            city: 'City'
        }));
        const nextList = Array.from({ length: 50 }).map((_, i) => ({
            id: `p${i+51}`,
            location_name: `Port ${i+51}`,
            location_code: `P${i+51}`,
            location_type: 'seaport',
            country: 'US',
            city: 'City'
        }));
        
        const chain = createMockChain();
        chain.mocks.range
            .mockResolvedValueOnce({ data: initialList, error: null })
            .mockResolvedValueOnce({ data: nextList, error: null });
            
        mockSupabase.from.mockImplementation(() => chain);

        render(<LocationAutocomplete onChange={() => {}} />);
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);

        await waitFor(() => {
            const options = screen.getAllByRole('option');
            expect(options.length).toBeGreaterThan(0);
        });

        // Load more
        const loadMoreButton = await screen.findByText('Load more ports…');
        fireEvent.click(loadMoreButton);
        
        await waitFor(() => {
            const options = screen.getAllByRole('option');
            expect(options.length).toBeGreaterThan(50);
        });
    });

    it('fetches details and populates input when value is provided but NOT in preloaded (RPC fetch)', async () => {
        const rpcData = [{
            id: '2',
            location_name: 'Rotterdam',
            location_code: 'NLRTM',
            city: 'Rotterdam',
            country: 'Netherlands',
            location_type: 'port'
        }];

        mockSupabase.rpc.mockResolvedValue({ data: rpcData, error: null });

        render(
            <LocationAutocomplete 
                value="Rotterdam" 
                onChange={() => {}} 
            />
        );

        await waitFor(() => {
             expect(mockSupabase.rpc).toHaveBeenCalledWith('search_locations', expect.objectContaining({
                 search_text: 'Rotterdam',
                 limit_count: expect.any(Number)
             }));
        });

        const button = screen.getByRole('combobox');
        expect(button).toHaveTextContent(/NLRTM/);
    });

    it('hydrates initial value from legacy RPC shape (name/code/type)', async () => {
        const legacyRpcData = [{
            id: '2',
            name: 'Rotterdam',
            code: 'NLRTM',
            type: 'port',
            country_name: 'Netherlands',
            city_name: 'Rotterdam',
            score: 100
        }];

        mockSupabase.rpc.mockResolvedValue({ data: legacyRpcData, error: null });

        render(
            <LocationAutocomplete
                value="Rotterdam"
                onChange={() => {}}
            />
        );

        await waitFor(() => {
            expect(mockSupabase.rpc).toHaveBeenCalledWith('search_locations', expect.objectContaining({
                search_text: 'Rotterdam',
                limit_count: expect.any(Number)
            }));
        });

        const button = screen.getByRole('combobox');
        expect(button).toHaveTextContent(/NLRTM/);
    });

    it('hydrates initial value when value is a UUID', async () => {
        const chain = createMockChain();
        chain.mocks.maybeSingle.mockResolvedValue({
            data: {
                id: '0b3c50dd-1111-4d2f-8d0a-222222222222',
                location_name: 'Singapore',
                location_code: 'SGSIN',
                location_type: 'seaport',
                country: 'Singapore',
                city: 'Singapore'
            },
            error: null
        });
        mockSupabase.from.mockImplementation(() => chain);

        render(
            <LocationAutocomplete
                value="0b3c50dd-1111-4d2f-8d0a-222222222222"
                onChange={() => {}}
            />
        );

        await waitFor(() => {
            const button = screen.getByRole('combobox');
            expect(button).toHaveTextContent(/Singapore/);
            expect(button).toHaveTextContent(/SGSIN/);
        });
    });

    it('does NOT auto-select partial matches on initial load', async () => {
        const rpcData = [{
            id: '3',
            location_name: 'Rotterdam Port', // Partial match for "Rotterdam"
            location_code: 'NLRTM',
            city: 'Rotterdam',
            country: 'Netherlands',
            location_type: 'port'
        }];

        mockSupabase.rpc.mockResolvedValue({ data: rpcData, error: null });

        render(
            <LocationAutocomplete 
                value="Rotterdam" 
                onChange={() => {}} 
            />
        );

        await waitFor(() => {
             expect(mockSupabase.rpc).toHaveBeenCalled();
        });

        const button = screen.getByRole('combobox');
        // Should show "Rotterdam" (value) not "Rotterdam Port" (rpc result)
        // because "Rotterdam" !== "Rotterdam Port"
        expect(button).toHaveTextContent('Rotterdam');
        expect(button).not.toHaveTextContent('NLRTM');
    });
});
