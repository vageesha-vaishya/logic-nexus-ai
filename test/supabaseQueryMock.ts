import { vi } from 'vitest';

/**
 * A chainable, awaitable stand-in for a Supabase/PostgREST query builder.
 * Every method returns the same object, so any call in the chain
 * (`.eq()`, `.select()`, `.single()`, ...) can be the last one before the
 * caller `await`s it -- matching how real query builders resolve.
 */
export function createChainableQuery(result: { data: unknown; error: unknown; count?: number }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    is: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
  return builder;
}
