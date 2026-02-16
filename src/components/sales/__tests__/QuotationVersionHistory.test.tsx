import { describe, it, vi, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { QuotationVersionHistory } from '../QuotationVersionHistory';
import * as UseToastModule from '@/components/ui/use-toast';
import { MemoryRouter } from 'react-router-dom';

describe('QuotationVersionHistory abort handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows toast on non-abort error during load', async () => {
    const err = new Error('network');
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { current_version_id: null }, error: null }),
      abortSignal: vi.fn().mockReturnThis(),
    };
    const mockVersionsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      data: null,
      error: err,
    };

    vi.doMock('@/hooks/useCRM', () => ({
      useCRM: () => ({
        supabase: {
          from: vi.fn((table: string) => {
            if (table === 'quotes') return mockChain as any;
            if (table === 'quotation_versions') return mockVersionsChain as any;
          }),
          auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
        },
        scopedDb: {
          from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            abortSignal: vi.fn().mockReturnThis(),
          })),
        },
      }),
    }));


    const toastSpy = vi.spyOn(UseToastModule, 'toast');
    render(
      <MemoryRouter>
        <QuotationVersionHistory quoteId="q1" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to load versions' })
      );
    });
  });
});
