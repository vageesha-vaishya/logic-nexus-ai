import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FormZone } from '../FormZone';
import { FormProvider, useForm } from 'react-hook-form';
import { QuoteComposerValues } from '../schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: false },
    },
});

// Mock UI components
// We simplify Select significantly to just be a standard HTML select for testing logic
vi.mock('@/components/ui/select', () => ({
  Select: ({ onValueChange, children, value }: any) => {
    // Extract options from children if possible, or just render a select that triggers change
    // Since Radix Select composition is complex, we'll just render a select and hidden children to avoid errors
    // Actually, let's just render a select and rely on manual fireEvent
    return (
      <div data-testid="select-wrapper">
        <select 
          data-testid="select-trigger" 
          onChange={(e) => onValueChange(e.target.value)}
          value={value}
        >
          {/* We need to render the options so they exist in the DOM for value matching if needed, 
              but for this test we mainly care about the onChange firing */}
           <option value="" disabled>Select...</option>
           <option value="opp-1">Opp 1</option>
           <option value="opp-2">Opp 2</option>
           <option value="opp-3">Opp 3</option>
        </select>
        <div style={{ display: 'none' }}>{children}</div>
      </div>
    );
  },
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

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

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({ 
    supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ data: [] }) }) }) }) },
    scopedDb: {},
    context: { tenantId: 'tenant-1' }
  }),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<QuoteComposerValues>({
    defaultValues: {
      mode: 'ocean',
      standalone: false,
    }
  });
  return (
    <QueryClientProvider client={queryClient}>
        <FormProvider {...methods}>{children}</FormProvider>
    </QueryClientProvider>
  );
};

describe('FormZone Logic', () => {
  const mockOpportunities = [
    { id: 'opp-1', name: 'Opp 1', account_id: 'acc-1', contact_id: 'con-1' }, // Fully linked
    { id: 'opp-2', name: 'Opp 2', account_id: 'acc-2' }, // Account only
    { id: 'opp-3', name: 'Opp 3' }, // Unlinked
  ];

  const mockAccounts = [
    { id: 'acc-1', name: 'Account 1' },
    { id: 'acc-2', name: 'Account 2' },
  ];

  const mockContacts = [
    { id: 'con-1', first_name: 'John', last_name: 'Doe', account_id: 'acc-1' },
    { id: 'con-2', first_name: 'Jane', last_name: 'Smith', account_id: 'acc-2' },
    { id: 'con-3', first_name: 'Bob', last_name: 'Jones', account_id: 'acc-2' },
  ];

  it.only('auto-populates Account and Contact when Opportunity is fully linked', async () => {
    let capturedValues: any = {};
    const handleChange = (vals: any) => { capturedValues = vals; };

    render(
      <Wrapper>
        <FormZone 
          onGetRates={vi.fn()} 
          opportunities={mockOpportunities}
          accounts={mockAccounts}
          contacts={mockContacts}
          onChange={handleChange}
        />
      </Wrapper>
    );

    // Simulate selecting Opp 1
    // Since we mocked Select with a native select, we can fire change on it
    // We need to find the Opportunity select. It's the first one in !standalone mode usually?
    // Wait, FormZone renders multiple selects. We need to distinguish them.
    // The mocked Select renders options. We can find by text?
    
    const selects = screen.getAllByTestId('select-trigger');
    // 0: Opportunity
    // 1: Account
    // 2: Contact
    // ...
    
    // Select Opp 1
    // Debug: print number of selects
    console.log('Number of selects found:', selects.length);
    
    fireEvent.change(selects[0], { target: { value: 'opp-1' } });

    await waitFor(() => {
        console.log('Current values:', capturedValues);
        expect(capturedValues.opportunityId).toBe('opp-1');
        expect(capturedValues.accountId).toBe('acc-1');
        expect(capturedValues.contactId).toBe('con-1');
    }, { timeout: 2000 });
  });

  it('auto-populates Account but not Contact if multiple contacts exist for unlinked Opp', async () => {
    let capturedValues: any = {};
    const handleChange = (vals: any) => { capturedValues = vals; };

    render(
      <Wrapper>
        <FormZone 
          onGetRates={vi.fn()} 
          opportunities={mockOpportunities}
          accounts={mockAccounts}
          contacts={mockContacts}
          onChange={handleChange}
        />
      </Wrapper>
    );

    const selects = screen.getAllByTestId('select-trigger');
    console.log('Test 2 Selects:', selects.length);
    
    fireEvent.change(selects[0], { target: { value: 'opp-2' } });

    await waitFor(() => {
        console.log('Test 2 Values:', capturedValues);
        expect(capturedValues.opportunityId).toBe('opp-2');
        expect(capturedValues.accountId).toBe('acc-2');
        expect(capturedValues.contactId).toBeFalsy(); 
    }, { timeout: 2000 });
  });
});
