import { describe, it, expect } from 'vitest';
import { reconcileContainerTypeWithSize } from '@/lib/container-utils';

describe('QUOTATION_PHASE2_GUARDS - container type/size reconciliation', () => {
  it('keeps original container_type_id when guards disabled', () => {
    const result = reconcileContainerTypeWithSize(
      'size-40hc',
      'type-loose',
      [{ id: 'size-40hc', type_id: 'type-40hc' }],
      false
    );

    expect(result).toBe('type-loose');
  });

  it('rewrites container_type_id to match size type when guards enabled', () => {
    const result = reconcileContainerTypeWithSize(
      'size-40hc',
      'type-loose',
      [{ id: 'size-40hc', type_id: 'type-40hc' }],
      true
    );

    expect(result).toBe('type-40hc');
  });

  it('leaves container_type_id unchanged when already matching size type', () => {
    const result = reconcileContainerTypeWithSize(
      'size-40hc',
      'type-40hc',
      [{ id: 'size-40hc', type_id: 'type-40hc' }],
      true
    );

    expect(result).toBe('type-40hc');
  });

  it('returns original type when size metadata missing', () => {
    const result = reconcileContainerTypeWithSize(
      'size-unknown',
      'type-loose',
      [{ id: 'size-40hc', type_id: 'type-40hc' }],
      true
    );

    expect(result).toBe('type-loose');
  });
});
