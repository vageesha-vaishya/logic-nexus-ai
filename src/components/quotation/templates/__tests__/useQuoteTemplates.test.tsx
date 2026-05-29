import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuoteTemplates } from '../useQuoteTemplates';

const {
  mockFrom,
  mockInfo,
  mockWarn,
  mockError,
  mockLog,
  mockToastSuccess,
  mockToastError,
  mockRoles,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockLog: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockRoles: [{ tenant_id: 'tenant-from-role' }] as Array<{ tenant_id?: string | null }>,
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    context: { tenantId: undefined },
    supabase: { from: mockFrom },
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    roles: mockRoles,
  }),
}));

vi.mock('@/hooks/useDebug', () => ({
  useDebug: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
    log: mockLog,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useQuoteTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoles.splice(0, mockRoles.length, { tenant_id: 'tenant-from-role' });
  });

  it('loads templates using tenant fallback from roles', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'tpl-1', name: 'Fallback Tenant Template' }],
      error: null,
    });
    const or = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ or });
    mockFrom.mockReturnValue({ select });

    const { result } = renderHook(() => useQuoteTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.templates).toHaveLength(1);
    });

    expect(mockFrom).toHaveBeenCalledWith('quote_templates');
    expect(or).toHaveBeenCalledWith('tenant_id.eq.tenant-from-role,tenant_id.is.null');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('creates, updates and deletes templates with success toasts and invalidation', async () => {
    const listOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const listOr = vi.fn().mockReturnValue({ order: listOrder });
    const listSelect = vi.fn().mockReturnValue({ or: listOr });

    const insertSingle = vi.fn().mockResolvedValue({ data: { id: 'new-id', name: 'New Template' }, error: null });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const updateSingle = vi.fn().mockResolvedValue({ data: { id: 'new-id', name: 'Updated Template' }, error: null });
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
    const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq: updateEq });

    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq: deleteEq });

    mockFrom.mockImplementation((table: string) => {
      if (table !== 'quote_templates') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        select: listSelect,
        insert,
        update,
        delete: del,
      };
    });

    const { result } = renderHook(() => useQuoteTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createTemplate.mutateAsync({
        name: 'New Template',
        content: { rows: [] },
      });
    });

    await act(async () => {
      await result.current.updateTemplate.mutateAsync({
        id: 'new-id',
        updates: { name: 'Updated Template' },
      });
    });

    await act(async () => {
      await result.current.deleteTemplate.mutateAsync('new-id');
    });

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'New Template',
        tenant_id: 'tenant-from-role',
      }),
    ]);
    expect(updateEq).toHaveBeenCalledWith('id', 'new-id');
    expect(deleteEq).toHaveBeenCalledWith('id', 'new-id');
    expect(mockToastSuccess).toHaveBeenCalledWith('Template created successfully');
    expect(mockToastSuccess).toHaveBeenCalledWith('Template updated successfully');
    expect(mockToastSuccess).toHaveBeenCalledWith('Template deleted successfully');
  });

  it('surfaces mutation errors with toast messaging', async () => {
    const listOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const listOr = vi.fn().mockReturnValue({ order: listOrder });
    const listSelect = vi.fn().mockReturnValue({ or: listOr });
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'duplicate template name' },
    });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    mockFrom.mockReturnValue({
      select: listSelect,
      insert,
      update: vi.fn(),
      delete: vi.fn(),
    });

    const { result } = renderHook(() => useQuoteTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      result.current.createTemplate.mutateAsync({
        name: 'Duplicate',
        content: {},
      }),
    ).rejects.toEqual(expect.objectContaining({ message: 'duplicate template name' }));

    expect(mockToastError).toHaveBeenCalledWith('Error creating template: duplicate template name');
  });

  it('handles template query failure and reports loading error', async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });
    const or = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ or });
    mockFrom.mockReturnValue({ select });

    const { result } = renderHook(() => useQuoteTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(mockToastError).not.toHaveBeenCalledWith('Error fetching templates');
    expect(mockError).toHaveBeenCalled();
  });

  it('uses null tenant when role fallback is unavailable', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const or = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ or });
    const insertSingle = vi.fn().mockResolvedValue({
      data: { id: 'null-tenant-template', name: 'Global Template' },
      error: null,
    });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    mockFrom.mockReturnValue({
      select,
      insert,
      update: vi.fn(),
      delete: vi.fn(),
    });

    mockRoles.splice(0, mockRoles.length);
    const { result } = renderHook(() => useQuoteTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.templates).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalledWith('quote_templates');

    await expect(
      result.current.createTemplate.mutateAsync({
        name: 'Global Template',
        content: { blocks: [] },
      }),
    ).rejects.toEqual(expect.objectContaining({ message: 'No tenant ID found' }));

    expect(insert).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith('Error creating template: No tenant ID found');
  });

  it('surfaces update and delete failures through toast handlers', async () => {
    const listOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const listOr = vi.fn().mockReturnValue({ order: listOrder });
    const listSelect = vi.fn().mockReturnValue({ or: listOr });

    const updateSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'template locked' },
    });
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
    const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq: updateEq });

    const deleteEq = vi.fn().mockResolvedValue({ error: { message: 'delete denied' } });
    const del = vi.fn().mockReturnValue({ eq: deleteEq });

    mockFrom.mockReturnValue({
      select: listSelect,
      insert: vi.fn(),
      update,
      delete: del,
    });

    const { result } = renderHook(() => useQuoteTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      result.current.updateTemplate.mutateAsync({
        id: 'tpl-locked',
        updates: { name: 'Cannot update' },
      }),
    ).rejects.toEqual(expect.objectContaining({ message: 'template locked' }));

    await expect(result.current.deleteTemplate.mutateAsync('tpl-locked')).rejects.toEqual(
      expect.objectContaining({ message: 'delete denied' }),
    );

    expect(mockError).toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith('Error updating template: template locked');
    expect(mockToastError).toHaveBeenCalledWith('Error deleting template: delete denied');
  });
});
