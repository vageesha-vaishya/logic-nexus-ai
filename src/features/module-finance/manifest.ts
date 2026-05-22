/**
 * Finance domain manifest. Phase 0 stub.
 * See docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 */
import type { DomainManifest } from "@/platform/domains/types";

export const financeManifest: DomainManifest = {
  code: "FINANCE",
  name: "Finance & Accounting",
  description: "Invoices, GL posting, Razorpay + GST, ledger.",
  brand: { cssVars: {}, hybridWithTenantBranding: true },
  routes: [],
  defaultAssignmentPolicy: "auto", // Finance is platform-baseline.
  requiredPermissions: ["finance.view"],
  seedMigration: "20260522142256_phase1_seed_missing_domains.sql",
};

export default financeManifest;
