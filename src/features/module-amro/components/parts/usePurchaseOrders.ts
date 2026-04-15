import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type PoStatus = 'draft' | 'submitted' | 'acknowledged' | 'shipped' | 'received' | 'cancelled';

export interface PoListItem {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string | null;
  status: PoStatus;
  order_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  total_amount: number;
  currency: string;
  notes: string | null;
  line_items_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoLineItem {
  id: string;
  part_inventory_id: string;
  part_number: string | null;
  serial_number: string | null;
  description: string | null;
  warehouse_location: string | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  line_total: number;
  notes: string | null;
}

export interface PoDetail {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string | null;
  status: PoStatus;
  order_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  total_amount: number;
  currency: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface PoSummary {
  total: number;
  draft: number;
  submitted: number;
  shipped: number;
  received: number;
  cancelled: number;
}

const PO_KEY = ['amro', 'inventory', 'purchase-orders'] as const;

// ── List POs ────────────────────────────────────────────────────────────────

async function fetchPos(
  status?: string,
  supplierId?: string,
  limit?: number,
): Promise<{ summary: PoSummary; items: PoListItem[] }> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (supplierId) params.set('supplier_id', supplierId);
  if (limit) params.set('limit', String(limit));

  const url = `/api/v2/amro/inventory/purchase-orders?${params.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Failed to list POs: ${response.status}`);
  const json = await response.json();
  return json.output;
}

export function useListPurchaseOrders(params: { status?: PoStatus; supplierId?: string; limit?: number; enabled?: boolean } = {}) {
  const { status, supplierId, limit, enabled = true } = params;
  return useQuery({
    queryKey: [...PO_KEY, 'list', status || 'all', supplierId || 'all', limit || 50] as const,
    queryFn: () => fetchPos(status, supplierId, limit),
    enabled,
    staleTime: 15_000,
    retry: 2,
  });
}

// ── Get single PO ───────────────────────────────────────────────────────────

async function fetchPo(id: string): Promise<{ purchase_order: PoDetail; line_items: PoLineItem[] }> {
  const url = `/api/v2/amro/inventory/purchase-orders?id=${id}`;
  const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Failed to get PO: ${response.status}`);
  const json = await response.json();
  return json.output;
}

export function usePurchaseOrder(id: string | null) {
  return useQuery({
    queryKey: [...PO_KEY, id || 'none'] as const,
    queryFn: () => fetchPo(id!),
    enabled: !!id,
    staleTime: 10_000,
    retry: 2,
  });
}

// ── Create PO ───────────────────────────────────────────────────────────────

interface CreatePoInput {
  supplier_id: string;
  expected_delivery_date?: string;
  notes?: string;
  line_items: Array<{
    part_inventory_id: string;
    quantity_ordered: number;
    unit_price: number;
    notes?: string;
  }>;
  metadata?: Record<string, unknown>;
}

async function mutateCreatePo(input: CreatePoInput): Promise<{
  id: string;
  po_number: string;
  status: PoStatus;
  total_amount: number;
  line_items_count: number;
}> {
  const response = await fetch('/api/v2/amro/inventory/purchase-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create PO failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateCreatePo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PO_KEY });
    },
  });
}

// ── Update PO ───────────────────────────────────────────────────────────────

interface UpdatePoInput {
  id: string;
  status?: PoStatus;
  expected_delivery_date?: string;
  notes?: string;
  actual_delivery_date?: string;
  metadata?: Record<string, unknown>;
}

async function mutateUpdatePo(input: UpdatePoInput): Promise<{
  id: string;
  po_number: string;
  status: PoStatus;
  actual_delivery_date: string | null;
}> {
  const response = await fetch(`/api/v2/amro/inventory/purchase-orders?id=${input.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: input.status,
      expected_delivery_date: input.expected_delivery_date,
      notes: input.notes,
      actual_delivery_date: input.actual_delivery_date,
      metadata: input.metadata,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Update PO failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateUpdatePo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PO_KEY });
    },
  });
}

// ── Delete PO ───────────────────────────────────────────────────────────────

async function mutateDeletePo(id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/inventory/purchase-orders?id=${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Delete PO failed: ${response.status} — ${text}`);
  }
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateDeletePo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PO_KEY });
    },
  });
}

// ── Invalidation helper ─────────────────────────────────────────────────────

export function usePurchaseOrderActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PO_KEY });
  }, [queryClient]);
  return { invalidate };
}
