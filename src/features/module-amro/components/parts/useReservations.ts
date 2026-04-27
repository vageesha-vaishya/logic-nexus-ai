import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type ReservationStatus = 'active' | 'fulfilled' | 'released' | 'expired' | 'cancelled';

export interface ReservationItem {
  id: string;
  inventory_id: string;
  part_number: string | null;
  serial_number: string | null;
  description: string | null;
  warehouse_location: string | null;
  work_order_id: string | null;
  task_id: string | null;
  reserved_quantity: number;
  status: ReservationStatus;
  reserved_by: string | null;
  expires_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservationResult {
  id: string;
  inventory_id: string;
  part_number: string | null;
  reserved_quantity: number;
  status: string;
  error?: string;
}

interface ListReservationsOutput {
  tenant_id: string;
  count: number;
  items: ReservationItem[];
}

interface ReservePartsOutput {
  tenant_id: string;
  work_order_id: string | null;
  task_id: string | null;
  total_requested: number;
  succeeded: number;
  failed: number;
  reservations: ReservationResult[];
  reserved_at: string;
}

interface ReleaseReservationOutput {
  reservation_id: string;
  inventory_id: string;
  released_quantity: number;
  status: string;
  released_at: string;
}

interface UseListReservationsParams {
  workOrderId?: string;
  inventoryId?: string;
  status?: ReservationStatus;
  limit?: number;
  enabled?: boolean;
}

const RESERVATIONS_KEY = ['amro', 'inventory', 'reservations'] as const;

// ── List reservations ───────────────────────────────────────────────────────

async function fetchReservations(
  workOrderId?: string,
  inventoryId?: string,
  status?: string,
  limit?: number,
): Promise<ListReservationsOutput> {
  const params = new URLSearchParams();
  if (workOrderId) params.set('work_order_id', workOrderId);
  if (inventoryId) params.set('inventory_id', inventoryId);
  if (status) params.set('status', status);
  if (limit) params.set('limit', String(limit));

  const url = `/api/v2/amro/inventory/reservations?${params.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Failed to list reservations: ${response.status}`);
  const json = await response.json();
  return json.output;
}

export function useListReservations(params: UseListReservationsParams = {}) {
  const { workOrderId, inventoryId, status, limit, enabled = true } = params;
  return useQuery({
    queryKey: [...RESERVATIONS_KEY, 'list', workOrderId || 'all', inventoryId || 'all', status || 'all', limit || 50] as const,
    queryFn: () => fetchReservations(workOrderId, inventoryId, status, limit),
    enabled,
    staleTime: 15_000,
    retry: 2,
  });
}

// ── Create reservation ──────────────────────────────────────────────────────

interface CreateReservationInput {
  workOrderId?: string;
  taskId?: string;
  expiresAt?: string;
  lineItems: Array<{ inventory_id: string; quantity: number; notes?: string }>;
}

async function mutateReservations(input: CreateReservationInput): Promise<ReservePartsOutput> {
  const response = await fetch('/api/v2/amro/inventory/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      work_order_id: input.workOrderId,
      task_id: input.taskId,
      expires_at: input.expiresAt,
      line_items: input.lineItems,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Reservation failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useCreateReservations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateReservations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESERVATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ['amro', 'inventory', 'availability'] });
    },
  });
}

// ── Release reservation ─────────────────────────────────────────────────────

async function mutateReleaseReservation(reservationId: string): Promise<ReleaseReservationOutput> {
  const response = await fetch(`/api/v2/amro/inventory/reservations?reservation_id=${reservationId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Release failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useReleaseReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateReleaseReservation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESERVATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ['amro', 'inventory', 'availability'] });
    },
  });
}

// ── Invalidation helper ─────────────────────────────────────────────────────

export function useReservationActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: RESERVATIONS_KEY });
    queryClient.invalidateQueries({ queryKey: ['amro', 'inventory', 'availability'] });
  }, [queryClient]);
  return { invalidate };
}
