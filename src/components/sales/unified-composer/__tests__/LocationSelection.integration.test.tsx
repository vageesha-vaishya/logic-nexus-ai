import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FormZone } from '../FormZone';
import { useForm, FormProvider } from 'react-hook-form';
import { quoteComposerSchema } from '../schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as useCRMHook from '@/hooks/useCRM';
import { QuoteStoreProvider } from '@/components/sales/composer/store/QuoteStore';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock useCRM
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

// Mock hooks
vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));
vi.mock('@/hooks/useIncoterms', () => ({
  useIncoterms: () => ({ incoterms: [], loading: false }),
}));
vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn() }),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

// Test Wrapper
const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const form = useForm({
    resolver: zodResolver(quoteComposerSchema),
    defaultValues: {
      mode: 'ocean',
      origin: '',
      originId: '',
      destination: '',
      destinationId: '',
      commodity: 'Test Commodity',
      standalone: false,
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <QuoteStoreProvider>
        <FormProvider {...form}>{children}</FormProvider>
      </QuoteStoreProvider>
    </QueryClientProvider>
  );
};

describe('Location Selection Logic', () => {
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useCRMHook.useCRM as any).mockReturnValue({
      scopedDb: {
        rpc: mockRpc,
        from: mockFrom,
      },
      user: { id: 'test-user' },
      context: { tenantId: 'test-tenant' },
    });
  });

  it('should set originId correctly when a valid location is selected', async () => {
    const mockLocations = [
      { id: 'loc-1', location_name: 'New York', location_code: 'NYC', city: 'New York', country: 'USA', location_type: 'port' },
    ];

    mockRpc.mockResolvedValue({ data: mockLocations, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      order: vi.fn().mockReturnThis(), // Add order mock
      range: vi.fn().mockReturnThis(), // Add range mock
    });

    // Mock initial load (empty search)
    mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    render(
      <Wrapper>
        <FormZone onGetRates={vi.fn()} />
      </Wrapper>
    );

    const trigger = screen.getByText('Search origin...');
    fireEvent.click(trigger);
    
    // Type search term
    const searchInput = await screen.findByPlaceholderText('Search port, airport, city...');
    fireEvent.change(searchInput, { target: { value: 'New' } });

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('search_locations', { search_text: 'New', limit_count: 10 });
    });

    const option = await screen.findByText('New York');
    fireEvent.click(option);
    expect(mockRpc).toHaveBeenCalled();
  });

  it('should handle RPC failure and use fallback', async () => {
    const mockFallbackLocations = [
      { id: 'loc-fallback', location_name: 'Fallback City', location_code: 'FBC', city: 'Fallback', country: 'Land', location_type: 'city' },
    ];

    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC Failed' } });
    
    // Mock fallback query
    const mockSelect = vi.fn().mockReturnThis();
    const mockOr = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue({ data: mockFallbackLocations, error: null });

    mockFrom.mockReturnValue({
      select: mockSelect,
      or: mockOr,
      limit: mockLimit,
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    });

    // Mock initial load
    mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    render(
      <Wrapper>
        <FormZone onGetRates={vi.fn()} />
      </Wrapper>
    );

   const trigger = screen.getByText('Search origin...');
    fireEvent.click(trigger);
    
    // Type search term
    const searchInput = await screen.findByPlaceholderText('Search port, airport, city...');fireEvent.change(searchInput, { target: { value: 'Fall' } });

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalled();
    });

    const option = await screen.findByText('Fallback City');
    expect(option).toBeInTheDocument();
  });

  it('should handle empty results gracefully', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    
    // Mock fallback query empty
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: mockLimit,
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    });
    
     // Mock initial load
    mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    render(
      <Wrapper>
        <FormZone onGetRates={vi.fn()} />
      </Wrapper>
    );

   const trigger = screen.getByText('Search origin...');
    fireEvent.click(trigger);

    // Type search term
    const searchInput = await screen.findByPlaceholderText('Search port, airport, city...');fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No locations found.')).toBeInTheDocument();
    });
  });
});
