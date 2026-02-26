import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

// Create a component that exposes form state for easier testing of the hook logic
const HookLogicTester = () => {
  const methods = useForm({
    defaultValues: {
      opportunity_id: '',
      account_id: '',
      contact_id: '',
      title: '',
      status: 'draft',
    }
  });

  const { setValue, watch } = methods;
  const values = watch();

  return (
    <FormProvider {...methods}>
      <QuoteHeader />
      {/* Hidden elements to verify state */}
      <div data-testid="values">{JSON.stringify(values)}</div>
      
      {/* Buttons to trigger changes */}
      <button data-testid="select-opp-1" onClick={() => setValue('opportunity_id', 'opp-1')} />
      <button data-testid="select-opp-2" onClick={() => setValue('opportunity_id', 'opp-2')} />
      <button data-testid="select-acc-2" onClick={() => setValue('account_id', 'acc-2')} />
    </FormProvider>
  );
};

describe('QuoteHeader Integration Logic', () => {
  it('should auto-populate fields correctly', async () => {
    render(<HookLogicTester />);

    // Helper to get current values
    const getValues = () => JSON.parse(screen.getByTestId('values').textContent || '{}');

    // 1. Select Opportunity 1 -> Should set Acc 1 and Con 1
    fireEvent.click(screen.getByTestId('select-opp-1'));
    
    await waitFor(() => {
        const vals = getValues();
        expect(vals.opportunity_id).toBe('opp-1');
        expect(vals.account_id).toBe('acc-1');
        expect(vals.contact_id).toBe('con-1');
    });
    
    // 2. Change Account to Acc 2 -> Should clear Opportunity 1 (mismatch)
    fireEvent.click(screen.getByTestId('select-acc-2'));
    
    await waitFor(() => {
        const vals = getValues();
        expect(vals.account_id).toBe('acc-2');
        expect(vals.opportunity_id).toBe(''); 
    }, { timeout: 3000 });
  });
});
