import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountService } from '../../src/services/account-service';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase Client
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(),
} as unknown as SupabaseClient;

describe('AccountService', () => {
  let accountService: AccountService;

  beforeEach(() => {
    accountService = new AccountService(mockSupabase);
    vi.clearAllMocks();
  });

  it('should validate and create account successfully', async () => {
    const validData = {
      name: 'Test Corp',
      tax_id: 'US123456789',
      billing_address: { street: '123 Main' },
      shipping_address: { street: '456 Side' },
      primary_contact: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        title: 'CEO'
      },
      references: [],
      notes: []
    };

    const mockResponse = { data: { account_id: '123', status: 'success' }, error: null };
    (mockSupabase.rpc as any).mockResolvedValue(mockResponse);

    const result = await accountService.createOrUpdateAccount(validData, 'tenant-1');
    
    // Check RPC call structure
    expect(mockSupabase.rpc).toHaveBeenCalledWith('manage_account', expect.objectContaining({
      p_name: 'Test Corp',
    }));
    
    expect(result).toEqual(mockResponse.data);
  });

  it('should throw validation error for invalid email', async () => {
    const invalidData = {
      name: 'Test Corp',
      tax_id: 'US123456789',
      primary_contact: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'invalid-email',
        phone: '1234567890'
      }
    };
    
    await expect(accountService.createOrUpdateAccount(invalidData as any, 'tenant-1'))
      .rejects.toThrow('Validation Failed');
  });

  it('should handle duplicate tax ID error from DB', async () => {
    const validData = {
      name: 'Test Corp',
      tax_id: 'US123456789',
    };

    (mockSupabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Duplicate Account detected with Tax ID: US123456789' }
    });
    
    // We expect the service to wrap/throw this error
    try {
        await accountService.createOrUpdateAccount(validData as any, 'tenant-1');
    } catch (e: any) {
        expect(e.message).toContain('Conflict');
    }
  });
});
