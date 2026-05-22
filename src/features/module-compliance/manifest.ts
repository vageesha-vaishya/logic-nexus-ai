/**
 * Compliance domain manifest. Phase 0 stub.
 * See docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 */
import type { DomainManifest } from "@/platform/domains/types";

export const complianceManifest: DomainManifest = {
  code: "COMPLIANCE",
  name: "Compliance",
  description: "KYC, audit logs, regulatory reporting.",
  brand: { cssVars: {}, hybridWithTenantBranding: true },
  routes: [],
  defaultAssignmentPolicy: "auto",
  requiredPermissions: ["compliance.view"],
  seedMigration: "20260522142256_phase1_seed_missing_domains.sql",
};

export default complianceManifest;
