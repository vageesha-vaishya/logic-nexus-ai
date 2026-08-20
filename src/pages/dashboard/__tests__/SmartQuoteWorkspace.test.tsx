import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SmartQuoteWorkspace from '../SmartQuoteWorkspace';

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: { functions: { invoke: vi.fn() }, from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }), auth: { getUser: () => Promise.resolve({ data: { user: null } }) } },
    context: { tenantId: 'tenant-1' },
    scopedDb: { from: () => ({ select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) },
  }),
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({ containerTypes: [], containerSizes: [] }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn().mockResolvedValue({ data: null, error: null }) }),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>
}));

describe('SmartQuoteWorkspace', () => {
  it('renders the Smart Quote form and an empty results placeholder', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/quotes/smart-quote']}>
          <SmartQuoteWorkspace />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByRole('heading', { name: /smart quote/i })).toBeInTheDocument();
    expect(screen.getByText(/fill out the form to generate quotes/i)).toBeInTheDocument();
  });
});
