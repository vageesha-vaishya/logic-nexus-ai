import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type ItemMasterType = 'part' | 'tool' | 'consumable' | 'kit';
export type ItemMasterStatus = 'active' | 'inactive' | 'deprecated' | 'retired';
export type ItemMasterLifecycle = 'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined';
export type CrossRefType = 'alternate' | 'superseded_by' | 'supersedes' | 'vendor' | 'oem';

export interface ItemMasterCrossRef {
  reference_type: CrossRefType;
  reference_part_number: string;
  reference_description: string | null;
  is_active: boolean;
}

export interface ItemMasterUomConversion {
  from_uom: string;
  to_uom: string;
  factor: number;
  rounding_mode: 'half_up' | 'up' | 'down';
  is_active: boolean;
}

export interface ItemMasterRecord {
  id: string;
  part_number: string;
  description: string | null;
  item_type: ItemMasterType;
  category: string | null;
  subcategory: string | null;
  status: ItemMasterStatus;
  lifecycle_status: ItemMasterLifecycle;
  specification: Record<string, unknown>;
  manufacturer_name: string | null;
  manufacturer_part_number: string | null;
  oem_part_number: string | null;
  unit_of_measure: string;
  base_unit_of_measure: string;
  uom_conversion_factor: number;
  currency: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  cross_references: ItemMasterCrossRef[];
  uom_conversions: ItemMasterUomConversion[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface UseListItemMasterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  itemType?: string;
  category?: string;
  enabled?: boolean;
}

const ITEM_MASTER_KEY = ['amro', 'item-master'] as const;

// ── List items ──────────────────────────────────────────────────────────────

async function fetchItemMasterList(params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  itemType?: string;
  category?: string;
}): Promise<{ records: ItemMasterRecord[]; total: number; page: number; pageSize: number }> {
  const qs = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.itemType ? { item_type: params.itemType } : {}),
    ...(params.category ? { category: params.category } : {}),
  });

  const url = `/api/v2/amro/item-master?${qs.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Failed to list item master: ${response.status}`);
  const json = await response.json();
  return json.output;
}

export function useListItemMaster(params: UseListItemMasterParams = {}) {
  const { page = 1, pageSize = 20, search, status, itemType, category, enabled = true } = params;
  return useQuery({
    queryKey: [...ITEM_MASTER_KEY, 'list', page, pageSize, search || 'all', status || 'all', itemType || 'all', category || 'all'] as const,
    queryFn: () => fetchItemMasterList({ page, pageSize, search, status, itemType, category }),
    enabled,
    staleTime: 30_000,
    retry: 2,
  });
}

// ── Get single item ─────────────────────────────────────────────────────────

async function fetchItemMaster(id: string): Promise<ItemMasterRecord> {
  const url = `/api/v2/amro/item-master/${id}`;
  const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Failed to get item master: ${response.status}`);
  const json = await response.json();
  return json.output.record;
}

export function useItemMaster(id: string | null) {
  return useQuery({
    queryKey: [...ITEM_MASTER_KEY, id || 'none'] as const,
    queryFn: () => fetchItemMaster(id!),
    enabled: !!id,
    staleTime: 30_000,
    retry: 2,
  });
}

// ── Create item ─────────────────────────────────────────────────────────────

interface CreateItemMasterInput {
  part_number: string;
  description?: string;
  item_type?: ItemMasterType;
  category?: string;
  subcategory?: string;
  manufacturer_name?: string;
  manufacturer_part_number?: string;
  oem_part_number?: string;
  unit_of_measure?: string;
  currency?: string;
  specification?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  cross_references?: Omit<ItemMasterCrossRef, 'is_active'>[];
  uom_conversions?: Omit<ItemMasterUomConversion, 'is_active'>[];
}

async function mutateCreateItemMaster(input: CreateItemMasterInput): Promise<{
  record: ItemMasterRecord;
}> {
  const response = await fetch('/api/v2/amro/item-master', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create item master failed: ${response.status} — ${text}`);
  }
  return response.json().then((j) => j.output);
}

export function useCreateItemMaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateCreateItemMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEM_MASTER_KEY });
    },
  });
}

// ── Update item ─────────────────────────────────────────────────────────────

interface UpdateItemMasterInput {
  id: string;
  description?: string;
  item_type?: ItemMasterType;
  category?: string;
  subcategory?: string;
  status?: ItemMasterStatus;
  lifecycle_status?: ItemMasterLifecycle;
  manufacturer_name?: string;
  manufacturer_part_number?: string;
  oem_part_number?: string;
  unit_of_measure?: string;
  is_active?: boolean;
  specification?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  cross_references?: Omit<ItemMasterCrossRef, 'is_active'>[];
  uom_conversions?: Omit<ItemMasterUomConversion, 'is_active'>[];
}

async function mutateUpdateItemMaster(input: UpdateItemMasterInput): Promise<{
  record: ItemMasterRecord;
}> {
  const response = await fetch(`/api/v2/amro/item-master/${input.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Update item master failed: ${response.status} — ${text}`);
  }
  return response.json().then((j) => j.output);
}

export function useUpdateItemMaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateUpdateItemMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEM_MASTER_KEY });
    },
  });
}

// ── Delete item ─────────────────────────────────────────────────────────────

async function mutateDeleteItemMaster(id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/item-master/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Delete item master failed: ${response.status} — ${text}`);
  }
}

export function useDeleteItemMaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateDeleteItemMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEM_MASTER_KEY });
    },
  });
}

// ── Invalidation helper ─────────────────────────────────────────────────────

export function useItemMasterActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ITEM_MASTER_KEY });
  }, [queryClient]);
  return { invalidate };
}
