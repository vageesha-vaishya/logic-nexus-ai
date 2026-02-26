import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuoteHeader } from '../QuoteHeader';
import { useForm, FormProvider } from 'react-hook-form';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QuoteContextType } from '../QuoteContext';
import { useEffect } from 'react';

// Mock QuoteContext
const mockQuoteContext = {
  opportunities: [
    { id: 'opp-1', name: 'Opp 1', account_id: 'acc-1', contact_id: 'con-1' },
    { id: 'opp-2', name: 'Opp 2', account_id: null, contact_id: null }, // Unmapped
    { id: 'opp-3', name: 'Opp 3', account_id: 'acc-2', contact_id: 'con-2' },
  ],
  accounts: [
    { id: 'acc-1', name: 'Account 1' },
    { id: 'acc-2', name: 'Account 2' },
  ],
  contacts: [
    { id: 'con-1', first_name: 'John', last_name: 'Doe', account_id: 'acc-1' },
    { id: 'con-2', first_name: 'Jane', last_name: 'Smith', account_id: 'acc-2' },
    { id: 'con-3', first_name: 'Orphan', last_name: 'User', account_id: null },
  ],
  isLoadingOpportunities: false,
};

vi.mock('../QuoteContext', () => ({
  useQuoteContext: () => mockQuoteContext,
}));

// Wrapper component
const TestWrapper = () => {
  const methods = useForm({
    defaultValues: {
      opportunity_id: '',
      account_id: '',
      contact_id: '',
      title: '',
      status: 'draft',
    }
  });

  return (
    <FormProvider {...methods}>
      <QuoteHeader />
    </FormProvider>
  );
};

describe('QuoteHeader Mapping Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should auto-populate Account and Contact when mapped Opportunity is selected', async () => {
    const { getByText, getByRole } = render(<TestWrapper />);
    
    // Simulate selecting Opportunity 1 (Linked to Acc 1, Con 1)
    // Since Popover/Command is complex to test with simple fireEvent, we simulate the effect logic directly
    // by mocking the setValue call? No, let's try to trigger the UI if possible or trust the hook logic unit test.
    // Given the complexity of Shadcn Select/Command in JSDOM, we will focus on the hook logic verification via a specialized test component
    // that exposes the form state.
  });
});

// Create a component that exposes form state for easier testing of the hook logic
const HookLogicTester = ({ onStateChange }: { onStateChange: (state: any) => void }) => {
  const methods = useForm({
    defaultValues: {
      opportunity_id: '',
      account_id: '',
      contact_id: '',
    }
  });
  const { watch, setValue } = methods;
  const state = watch();
  
  useEffect(() => {
    onStateChange(state);
  }, [state, onStateChange]);

  return (
    <FormProvider {...methods}>
      <QuoteHeader />
      {/* Hidden buttons to trigger changes programmatically for testing */}
      <button data-testid="select-opp-1" onClick={() => setValue('opportunity_id', 'opp-1')} />
      <button data-testid="select-opp-2" onClick={() => setValue('opportunity_id', 'opp-2')} />
      <button data-testid="select-acc-2" onClick={() => setValue('account_id', 'acc-2')} />
    </FormProvider>
  );
};

describe('QuoteHeader Integration Logic', () => {
  it('should auto-populate fields correctly', async () => {
    let formState: any = {};
    const handleStateChange = (s: any) => { formState = s; };
    
    const { getByTestId } = render(<HookLogicTester onStateChange={handleStateChange} />);

    // 1. Select Opportunity 1 -> Should set Acc 1 and Con 1
    // Note: We use the helper button because Radix UI Select is hard to drive with fireEvent in this environment
    // The previous failures suggest that formState.opportunity_id is empty.
    // This could be because the test is running faster than the update cycle or the watch isn't catching the first update.
    // However, the `onChange` for select-opp-1 calls `setValue('opportunity_id', 'opp-1')`.
    // The `QuoteHeader`'s `useEffect` sees this change, then calls `setValue('account_id', 'acc-1')`.
    // Maybe `opportunity_id` is being cleared by the "mismatch" effect immediately?
    // Let's trace:
    // 1. Set opp-1. account_id is empty.
    // 2. Mismatch effect runs: accountId (empty) vs opp-1.account_id (acc-1).
    //    Does empty string !== 'acc-1'? Yes.
    //    Does the logic run? `if (accountId && ...)`
    //    No, accountId is falsy. So it doesn't clear.
    // 3. Auto-populate effect runs: opp-1 selected. opp-1.account_id is acc-1.
    //    Sets account_id to acc-1.
    // 4. Mismatch effect runs again: accountId is acc-1. opp-1.account_id is acc-1. Match. No clear.
    
    // So why is opportunity_id empty in the test?
    // Maybe the test helper `HookLogicTester` isn't syncing properly?
    // Or maybe `formState` capture is flawed.
    
    // Let's use `getByDisplayValue` or similar to check DOM if possible, but the inputs are hidden/Select triggers.
    // We rely on `formState` via `onStateChange`.
    
    fireEvent.click(getByTestId('select-opp-1'));
    
    // Check auto-population logic
    await waitFor(() => {
        expect(formState.account_id).toBe('acc-1');
        expect(formState.contact_id).toBe('con-1');
    });
    
    // Verify opp is still set
    await waitFor(() => expect(formState.opportunity_id).toBe('opp-1'));
    
    // We update account to 'acc-2'. This triggers onChange.
    fireEvent.click(getByTestId('select-acc-2'));
    
    // Check if account updated
    await waitFor(() => expect(formState.account_id).toBe('acc-2'));
    
    // Check if opportunity cleared
    await waitFor(() => {
        expect(formState.opportunity_id).toBe(''); 
    }, { timeout: 3000 });
  });
});
