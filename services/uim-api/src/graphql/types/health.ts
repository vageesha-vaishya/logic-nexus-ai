// Phase 7 UIM Step 8.1 — UimHealth type.
//
// Mirrors the 4b.10 shim's uimHealth response shape exactly so
// existing callers see no functional change when they switch to
// the /v2 schema.

import { builder } from '../builder.js';

export type UimHealthRow = {
  status: string;
  apiVersion: string;
  schemaPath: string;
};

export const UimHealthRef = builder.objectRef<UimHealthRow>('UimHealth');

builder.objectType(UimHealthRef, {
  description: 'Service health snapshot — mirrors the 4b.10 shim shape.',
  fields: (t) => ({
    status: t.exposeString('status'),
    apiVersion: t.exposeString('apiVersion'),
    schemaPath: t.exposeString('schemaPath'),
  }),
});
