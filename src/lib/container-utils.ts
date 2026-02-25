
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
