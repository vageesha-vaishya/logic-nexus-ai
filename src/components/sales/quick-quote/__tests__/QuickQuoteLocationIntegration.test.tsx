import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickQuoteModal } from '../QuickQuoteModal';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

// Mocks
const mockSupabase = {
    auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user1' } } })
    },
    functions: {
        invoke: vi.fn().mockResolvedValue({ data: { options: [] }, error: null })
    },
    rpc: vi.fn().mockResolvedValue({
        data: [
            {
                id: '1',
                name: 'Shanghai Port',
                code: 'CNSHA',
                type: 'Port',
                country_name: 'China',
                city_name: 'Shanghai',
                score: 100
            }
        ],
        error: null
    }),
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                or: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null })
                }))
            }))
        })),
        insert: vi.fn().mockResolvedValue({ error: null })
    }))
};

vi.mock('@/hooks/useCRM', () => ({
    useCRM: () => ({
        supabase: mockSupabase,
        context: { tenantId: 'tenant1' }
    })
}));

vi.mock('@/hooks/useDebounce', () => ({
    useDebounce: (value: any) => value
}));

// Mock Toaster
vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: vi.fn() })
}));

// Mock ResizeObserver for Radix UI
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('QuickQuoteModal Location Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.rpc.mockResolvedValue({
            data: [
                {
                    id: '1',
                    name: 'Shanghai Port',
                    code: 'CNSHA',
                    type: 'Port',
                    country_name: 'China',
                    city_name: 'Shanghai',
                    score: 100
                }
            ],
            error: null
        });
    });

    const renderModal = () => {
        return render(
            <BrowserRouter>
                <QuickQuoteModal />
            </BrowserRouter>
        );
    };

    it('updates origin field when location is selected', async () => {
        renderModal();
        
        // Open the modal
        const trigger = screen.getByText('Quick Quote');
        fireEvent.click(trigger);
        
        // Wait for modal to open
        await waitFor(() => {
            expect(screen.getByText('Quick Quote & AI Analysis')).toBeInTheDocument();
        });

        // Find origin trigger button
        const originTrigger = screen.getByText('Search origin port, airport, or city...');
        fireEvent.click(originTrigger);

        // Find search input in popover
        const searchInput = screen.getByPlaceholderText('Search port, airport, city...');
        fireEvent.change(searchInput, { target: { value: 'Shanghai' } });

        // Wait for results via RPC
        await waitFor(() => {
            expect(mockSupabase.rpc).toHaveBeenCalledWith('search_locations', { 
                search_text: 'Shanghai',
                limit_count: 10
            });
        });
        
        // Select the location
        const suggestion = await screen.findByText('Shanghai Port');
        fireEvent.click(suggestion);

        // Verify input value updated
        // The trigger text should now reflect the selection "Shanghai Port (CNSHA)"
        await waitFor(() => {
            expect(screen.getByText('Shanghai Port (CNSHA)')).toBeInTheDocument();
        });
    });
});
