import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocationAutocomplete } from '../LocationAutocomplete';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Mock useCRM hook
const mockSupabase: any = {
    rpc: vi.fn().mockResolvedValue({
        data: [
            {
                id: '1',
                name: 'Los Angeles Port',
                code: 'USLAX',
                type: 'Port',
                country_name: 'USA',
                city_name: 'Los Angeles',
                score: 100
            },
            {
                id: '2',
                name: 'JFK Airport',
                code: 'USJFK',
                type: 'Airport',
                country_name: 'USA',
                city_name: 'New York',
                score: 90
            }
        ],
        error: null
    }),
    from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                    data: [],
                    error: null
                })
            })
        })
    })
};

vi.mock('@/hooks/useCRM', () => ({
    useCRM: () => ({
        supabase: mockSupabase
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
                    name: 'Los Angeles Port',
                    code: 'USLAX',
                    type: 'Port',
                    country_name: 'USA',
                    city_name: 'Los Angeles',
                    score: 100
                },
                {
                    id: '2',
                    name: 'JFK Airport',
                    code: 'USJFK',
                    type: 'Airport',
                    country_name: 'USA',
                    city_name: 'New York',
                    score: 90
                }
            ],
            error: null
        });
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

    it('falls back to ports_locations when RPC returns empty', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({
            data: [],
            error: null
        });
        mockSupabase.from = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                        data: [
                            { id: 'p1', location_name: 'Fallback Port', location_code: 'FB001', location_type: 'seaport', country: 'US', city: 'Fallback' }
                        ],
                        error: null
                    })
                })
            })
        } as any);

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
        mockSupabase.from = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                        data: [],
                        error: null
                    })
                })
            })
        } as any);

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
        const selectMock = vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
                range: vi.fn()
                    // First page
                    .mockResolvedValueOnce({ data: initialList, error: null })
                    // Second page
                    .mockResolvedValueOnce({ data: nextList, error: null })
            })
        });
        mockSupabase.from = vi.fn().mockReturnValue({
            select: selectMock
        } as any);

        render(<LocationAutocomplete onChange={() => {}} />);
        const trigger = screen.getByRole('combobox');
        fireEvent.click(trigger);

        await waitFor(() => {
            const options = screen.getAllByRole('option');
            expect(options.length).toBeGreaterThan(0);
        });

        // Load more
        fireEvent.click(screen.getByText('Load more ports…'));
        await waitFor(() => {
            const options = screen.getAllByRole('option');
            expect(options.length).toBeGreaterThan(50);
        });
    });
});
