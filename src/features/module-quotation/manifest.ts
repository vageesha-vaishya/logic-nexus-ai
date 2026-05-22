/**
 * Quotation domain manifest. Phase 0 stub.
 * See docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 */
import type { DomainManifest } from "@/platform/domains/types";

export const quotationManifest: DomainManifest = {
  code: "QUOTATION",
  name: "Quotation & Unified Composer",
  description: "Quote composer, PDF export, multi-channel sending.",
  brand: { cssVars: {}, hybridWithTenantBranding: true },
  routes: [],
  defaultAssignmentPolicy: "opt-in",
  requiredPermissions: ["quotation.view"],
  seedMigration: "20260522142256_phase1_seed_missing_domains.sql",
  defaultRoute: "/dashboard/quotations",
};

export default quotationManifest;
