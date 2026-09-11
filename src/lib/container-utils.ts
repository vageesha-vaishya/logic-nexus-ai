
/**
 * Utilities for formatting and normalizing container information
 */

/**
 * Extracts the numeric size from a container size name.
 * Examples:
 * - "20' Standard" -> "20"
 * - "40ft High Cube" -> "40"
 * - "45" -> "45"
 * - "Standard" -> "Standard" (fallback)
 * - UUID -> "" (returns empty string if it looks like a UUID to avoid displaying raw IDs)
 */
export function formatContainerSize(name: string | null | undefined): string {
  if (!name) return '';
  
  const str = String(name);

  // If it's a UUID, return empty (likely a raw ID reference without a joined name)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
      return '';
  }

  // Extract number
  const match = str.match(/(\d+)/);
  if (match) {
    return match[0];
  }
  
  return str;
}

/**
 * public.container_sizes has no name/code/iso_code label column at all --
 * only dimensional data (length_ft, is_high_cube, is_pallet_wide, etc, see
 * \d public.container_sizes). Every consumer that queried this table for a
 * "name" column was silently 400ing and falling back to a small hardcoded
 * list. This derives a human label from the real columns instead of
 * inventing a fact (like a specific ISO 6346 code) the table doesn't have.
 */
export function deriveContainerSizeLabel(row: {
  length_ft?: number | string | null;
  is_high_cube?: boolean | null;
  is_pallet_wide?: boolean | null;
}): string {
  const lengthFt = row.length_ft != null ? Number(row.length_ft) : NaN;
  if (!Number.isFinite(lengthFt)) return '';
  const parts = [`${lengthFt}ft`];
  if (row.is_high_cube) parts.push('High Cube');
  if (row.is_pallet_wide) parts.push('Pallet Wide');
  return parts.join(' ');
}

export function reconcileContainerTypeWithSize(
  containerSizeId: string | null | undefined,
  containerTypeId: string | null | undefined,
  containerSizes: Array<{ id: string; type_id?: string }> | null | undefined,
  guardsEnabled: boolean
): string | null | undefined {
  if (!guardsEnabled || !containerSizeId || !Array.isArray(containerSizes)) {
    return containerTypeId;
  }

  const sizeMeta = containerSizes.find(s => s.id === containerSizeId);
  const expectedTypeId = sizeMeta?.type_id;

  if (!expectedTypeId) {
    return containerTypeId;
  }

  if (!containerTypeId || containerTypeId !== expectedTypeId) {
    return expectedTypeId;
  }

  return containerTypeId;
}
