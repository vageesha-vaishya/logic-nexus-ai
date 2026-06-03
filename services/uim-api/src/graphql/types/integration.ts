// Phase 7 UIM Step 8.5 — Integration type.
//
// Backed by uim.integrations (Phase 7 Step 1 mirror table).

import { builder } from '../builder.js';

export type IntegrationRow = {
  id: string;
  tenant_id: string | null;
  vendor_name: string | null;
  vendor_code: string | null;
  kind: string;
  lifecycle_state: string | null;
  vendor_risk_class: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export const IntegrationRef = builder.objectRef<IntegrationRow>('Integration');

builder.objectType(IntegrationRef, {
  description: 'An external integration definition (vendor_name + kind + lifecycle).',
  fields: (t) => ({
    id: t.exposeID('id'),
    tenantId: t.id({ nullable: true, resolve: (p) => p.tenant_id }),
    vendorName: t.string({ nullable: true, resolve: (p) => p.vendor_name }),
    vendorCode: t.string({ nullable: true, resolve: (p) => p.vendor_code }),
    kind: t.exposeString('kind'),
    lifecycleState: t.string({ nullable: true, resolve: (p) => p.lifecycle_state }),
    vendorRiskClass: t.string({ nullable: true, resolve: (p) => p.vendor_risk_class }),
    config: t.field({ type: 'JSON', nullable: true, resolve: (p) => p.config }),
    createdAt: t.field({ type: 'DateTime', resolve: (p) => p.created_at }),
    updatedAt: t.field({ type: 'DateTime', resolve: (p) => p.updated_at }),
  }),
});
