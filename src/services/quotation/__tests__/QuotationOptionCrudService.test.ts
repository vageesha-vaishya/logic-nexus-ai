import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotationOptionCrudService } from '../QuotationOptionCrudService';

describe('QuotationOptionCrudService', () => {
  let service: QuotationOptionCrudService;
  let mockDb: any;
  let mockRpc: any;

  beforeEach(() => {
    mockRpc = vi.fn();
    mockDb = {
      rpc: mockRpc,
    };
    service = new QuotationOptionCrudService(mockDb);
  });

  it('should call delete_quote_option_safe RPC with correct parameters', async () => {
    const optionId = 'test-option-id';
    const reason = 'User removed option';
    const mockResponse = { data: { ok: true, reselected_option_id: 'new-id' }, error: null };
    
    mockRpc.mockResolvedValue(mockResponse);

    const result = await service.deleteOption(optionId, reason);

    expect(mockRpc).toHaveBeenCalledWith('delete_quote_option_safe', {
      p_option_id: optionId,
      p_reason: reason,
    });
    expect(result).toEqual({ reselectedOptionId: 'new-id' });
  });

  it('should throw error if RPC returns database error', async () => {
    const error = new Error('Database error');
    mockRpc.mockResolvedValue({ data: null, error });

    await expect(service.deleteOption('id', 'reason')).rejects.toThrow('Database error');
  });

  it('should throw error if RPC returns ok: false', async () => {
    mockRpc.mockResolvedValue({ 
      data: { ok: false, error: 'Custom logic error' }, 
      error: null 
    });

    await expect(service.deleteOption('id', 'reason')).rejects.toThrow('Custom logic error');
  });

  it('should use default reason if not provided', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });

    await service.deleteOption('id');

    expect(mockRpc).toHaveBeenCalledWith('delete_quote_option_safe', {
      p_option_id: 'id',
      p_reason: null,
    });
  });
});
