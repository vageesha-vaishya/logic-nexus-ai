/**
 * Logistics domain manifest. Phase 0 stub — routes still in App.tsx.
 * See docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 */
import type { DomainManifest } from "@/platform/domains/types";

export const logisticsManifest: DomainManifest = {
  code: "LOGISTICS",
  name: "Logistics & Supply Chain",
  description: "Shipments, carriers, ports, rate matrices, transport modes.",
  brand: { cssVars: {}, hybridWithTenantBranding: true },
  routes: [],
  defaultAssignmentPolicy: "opt-in",
  requiredPermissions: ["logistics.view"],
  seedMigration: "20260131053539_sync_logistics_domain.sql",
};

export default logisticsManifest;
