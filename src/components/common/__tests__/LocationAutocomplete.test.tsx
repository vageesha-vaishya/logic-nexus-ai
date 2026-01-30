import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocationAutocomplete } from '../LocationAutocomplete';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Mock useCRM hook
const mockSupabase = {
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
});
