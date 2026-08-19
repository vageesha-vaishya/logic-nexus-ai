import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCRMAuditTrail } from '@/hooks/useCRMAuditTrail';

// useCRMAuditTrail uses TanStack Query's useQuery internally, which requires
// a QueryClientProvider in the React tree. The implementation plan's test
// snippet renders the hook directly without one; that wrapper is added here
// (assertions unchanged) so the hook can actually mount, matching the pattern
// used by the other TanStack-Query-backed hook tests in this repo
// (see src/hooks/__tests__/useIncoterms.test.tsx).
const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
};

describe('useCRMAuditTrail', () => {
  it('should fetch audit logs for an entity', async () => {
    const { result } = renderHook(
      () => useCRMAuditTrail({ entityType: 'lead', entityId: 'lead-123' }),
      { wrapper: createWrapper() }
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(
      () => useCRMAuditTrail({ entityType: 'lead', entityId: 'invalid-id' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error || result.current.data.length === 0).toBe(true);
  });
});
