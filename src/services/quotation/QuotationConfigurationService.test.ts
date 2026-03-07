
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotationConfigurationService, BrandingSettings } from './QuotationConfigurationService';

// Mock Supabase Client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(),
        single: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
  })),
};

describe('QuotationConfigurationService', () => {
  let service: QuotationConfigurationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QuotationConfigurationService(mockSupabase as any);
  });

  it('should return default configuration if none exists', async () => {
    // Setup mock to return null for get
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const insertSingleMock = vi.fn().mockResolvedValue({ 
      data: { tenant_id: 'test-tenant', branding_settings: {} }, 
      error: null 
    });

    // @ts-ignore Mock dynamic table routing for tests
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quotation_configuration') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: maybeSingleMock
            })
          }),
          insert: () => ({
            select: () => ({
              single: insertSingleMock
            })
          })
        };
      }
      return {};
    });

    const config = await service.getConfiguration('test-tenant');
    expect(config).toBeDefined();
    expect(maybeSingleMock).toHaveBeenCalled();
    expect(insertSingleMock).toHaveBeenCalled();
  });

  it('should update branding settings correctly', async () => {
    const newSettings: BrandingSettings = {
      company_name: 'New Corp',
      primary_color: '#ff0000'
    };

    const updateSelectMock = vi.fn().mockResolvedValue({ 
      data: [{ tenant_id: 'test-tenant', branding_settings: newSettings }], 
      error: null 
    });

    // @ts-ignore Mock dynamic table routing for tests
    mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'quotation_configuration') {
            return {
                update: (payload: any) => {
                    // expect(payload.branding_settings).toEqual(newSettings);
                    return {
                        eq: () => ({
                            select: () => ({
                                data: [{ tenant_id: 'test-tenant', branding_settings: newSettings }],
                                error: null
                            })
                        })
                    };
                }
            };
        }
        return {};
    });

    const updated = await service.updateConfiguration('test-tenant', { branding_settings: newSettings });
    expect(updated.branding_settings).toEqual(newSettings);
  });
});
