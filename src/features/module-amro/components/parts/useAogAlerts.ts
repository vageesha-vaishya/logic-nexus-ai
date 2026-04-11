import { useQuery, useMutation, useQueryClient, useCallback } from '@tanstack/react-query';

export type AogSeverity = 'critical' | 'high' | 'medium';
export type AogStatus = 'open' | 'escalated' | 'resolved' | 'cancelled';

export interface AogAlertItem {
  id: string;
  aircraft_id: string | null;
  part_inventory_id: string;
  part_number: string | null;
  serial_number: string | null;
  description: string | null;
  warehouse_location: string | null;
  severity: AogSeverity;
  status: AogStatus;
  shortage_quantity: number;
  required_quantity: number;
  required_by: string | null;
  escalation_level: number;
  resolved_at: string | null;
  resolution_notes: string | null;
  notified_users: string[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface AogAlertSummary {
  total: number;
  open: number;
  escalated: number;
  critical: number;
}

interface UseListAogAlertsParams {
  status?: AogStatus;
  severity?: AogSeverity;
  aircraftId?: string;
  partInventoryId?: string;
  limit?: number;
  enabled?: boolean;
}

const AOG_ALERTS_KEY = ['amro', 'inventory', 'aog-alerts'] as const;

// ── List AOG alerts ─────────────────────────────────────────────────────────

async function fetchAogAlerts(
  status?: string,
  severity?: string,
  aircraftId?: string,
  partInventoryId?: string,
  limit?: number,
): Promise<{ summary: AogAlertSummary; items: AogAlertItem[] }> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (severity) params.set('severity', severity);
  if (aircraftId) params.set('aircraft_id', aircraftId);
  if (partInventoryId) params.set('part_inventory_id', partInventoryId);
  if (limit) params.set('limit', String(limit));

  const url = `/api/v2/amro/inventory/aog-alerts?${params.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Failed to list AOG alerts: ${response.status}`);
  const json = await response.json();
  return json.output;
}

export function useListAogAlerts(params: UseListAogAlertsParams = {}) {
  const { status, severity, aircraftId, partInventoryId, limit, enabled = true } = params;
  return useQuery({
    queryKey: [...AOG_ALERTS_KEY, 'list', status || 'all', severity || 'all', aircraftId || 'all', partInventoryId || 'all', limit || 100] as const,
    queryFn: () => fetchAogAlerts(status, severity, aircraftId, partInventoryId, limit),
    enabled,
    staleTime: 15_000,
    retry: 2,
  });
}

// ── Get single alert ────────────────────────────────────────────────────────

async function fetchAogAlert(id: string): Promise<AogAlertItem> {
  const url = `/api/v2/amro/inventory/aog-alerts?id=${id}`;
  const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Failed to get AOG alert: ${response.status}`);
  const json = await response.json();
  return json.output.item;
}

export function useAogAlert(id: string | null) {
  return useQuery({
    queryKey: [...AOG_ALERTS_KEY, id || 'none'] as const,
    queryFn: () => fetchAogAlert(id!),
    enabled: !!id,
    staleTime: 10_000,
    retry: 2,
  });
}

// ── Create alert ────────────────────────────────────────────────────────────

interface CreateAogAlertInput {
  part_inventory_id: string;
  required_quantity: number;
  severity?: AogSeverity;
  aircraft_id?: string;
  required_by?: string;
  notified_users?: string[];
  metadata?: Record<string, unknown>;
}

async function mutateCreateAogAlert(input: CreateAogAlertInput): Promise<{
  alert_id: string;
  part_number: string | null;
  severity: AogSeverity;
  shortage_quantity: number;
  escalation_level: number;
}> {
  const response = await fetch('/api/v2/amro/inventory/aog-alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create AOG alert failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useCreateAogAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateCreateAogAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AOG_ALERTS_KEY });
    },
  });
}

// ── Update alert (escalate, resolve, cancel) ────────────────────────────────

interface UpdateAogAlertInput {
  id: string;
  status?: AogStatus;
  resolution_notes?: string;
  notified_users?: string[];
  metadata?: Record<string, unknown>;
}

async function mutateUpdateAogAlert(input: UpdateAogAlertInput): Promise<{
  alert_id: string;
  status: AogStatus;
  escalation_level: number;
  resolved_at: string | null;
  resolution_notes: string | null;
}> {
  const response = await fetch(`/api/v2/amro/inventory/aog-alerts?id=${input.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: input.status,
      resolution_notes: input.resolution_notes,
      notified_users: input.notified_users,
      metadata: input.metadata,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Update AOG alert failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useUpdateAogAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateUpdateAogAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AOG_ALERTS_KEY });
    },
  });
}

// ── Delete alert ────────────────────────────────────────────────────────────

async function mutateDeleteAogAlert(id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/inventory/aog-alerts?id=${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Delete AOG alert failed: ${response.status} — ${text}`);
  }
}

export function useDeleteAogAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateDeleteAogAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AOG_ALERTS_KEY });
    },
  });
}

// ── Invalidation helper ─────────────────────────────────────────────────────

export function useAogAlertActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: AOG_ALERTS_KEY });
  }, [queryClient]);
  return { invalidate };
}
