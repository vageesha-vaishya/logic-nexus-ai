// Phase 7 UIM Step 8.5 — Integration type.
//
// Backed by uim.integrations (Phase 7 Step 1 mirror table).
// Columns: kind, name, vendor, scope_json, vendor_risk_class,
// owner_user_id, lifecycle_state, metadata, direction (Step 7.1).

import { builder } from '../builder.js';

export type IntegrationRow = {
  id: string;
  tenant_id: string | null;
  name: string | null;
  vendor: string | null;
  kind: string;
  lifecycle_state: string | null;
  direction: string | null;
  vendor_risk_class: string | null;
  scope_json: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export const IntegrationRef = builder.objectRef<IntegrationRow>('Integration');

builder.objectType(IntegrationRef, {
  description: 'An external integration definition (vendor + kind + direction + lifecycle).',
  fields: (t) => ({
    id: t.exposeID('id'),
    tenantId: t.id({ nullable: true, resolve: (p) => p.tenant_id }),
    name: t.string({ nullable: true, resolve: (p) => p.name }),
    vendor: t.string({ nullable: true, resolve: (p) => p.vendor }),
    kind: t.exposeString('kind'),
    lifecycleState: t.string({ nullable: true, resolve: (p) => p.lifecycle_state }),
    direction: t.string({ nullable: true, resolve: (p) => p.direction }),
    vendorRiskClass: t.string({ nullable: true, resolve: (p) => p.vendor_risk_class }),
    scopeJson: t.field({ type: 'JSON', nullable: true, resolve: (p) => p.scope_json }),
    metadata: t.field({ type: 'JSON', nullable: true, resolve: (p) => p.metadata }),
    ownerUserId: t.id({ nullable: true, resolve: (p) => p.owner_user_id }),
    createdAt: t.field({ type: 'DateTime', resolve: (p) => p.created_at }),
    updatedAt: t.field({ type: 'DateTime', resolve: (p) => p.updated_at }),
  }),
});
