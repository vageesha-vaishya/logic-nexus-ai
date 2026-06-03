// Phase 7 UIM Step 8.1 — Pothos schema builder + context type.
//
// Single SchemaBuilder instance shared by every type/query module.
// Context is what each resolver receives as the 3rd arg; the yoga
// context() factory in server.ts populates it from the Express
// request that auth.middleware already authenticated.

import SchemaBuilder from '@pothos/core';
import type { SupabaseClient } from '@supabase/supabase-js';

export type GraphQLContext = {
  userId: string;
  tenantId: string;
  franchiseId: string | null;
  supabase: SupabaseClient;
};

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  Scalars: {
    DateTime: { Input: string; Output: string };
    JSON: { Input: unknown; Output: unknown };
    ID: { Input: string; Output: string };
  };
}>({});

// Custom scalars — defined here so every type file can use them.
//
// DateTime is ISO-8601; serialized through JSON.stringify untouched.
// We don't validate input shape strictly — Postgres bounces bad
// timestamps with a clear error message.
builder.scalarType('DateTime', {
  serialize: (value) => String(value),
  parseValue: (value) => String(value),
});

// JSON scalar — pass-through for arbitrary JSONB payloads
// (uim_inventory_items.metadata, uim_inventory_reservations.metadata,
// uim_catalog_items.attributes). Typed sub-objects ship in v2 per
// the design doc §13 question 3.
builder.scalarType('JSON', {
  serialize: (value) => value,
  parseValue: (value) => value,
});

// Query root must be declared once. Every queries/*.ts file adds
// fields via builder.queryFields(...).
builder.queryType({});
