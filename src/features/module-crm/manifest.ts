/**
 * CRM domain manifest. Phase 0 stub — routes still in App.tsx.
 * See docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 */
import type { DomainManifest } from "@/platform/domains/types";

export const crmManifest: DomainManifest = {
  code: "CRM",
  name: "Customer Relationship Management",
  description: "Leads, accounts, contacts, activities, pipeline, quotation.",
  brand: { cssVars: {}, hybridWithTenantBranding: true },
  routes: [],
  defaultAssignmentPolicy: "auto", // CRM is the baseline domain — every tenant gets it.
  requiredPermissions: ["crm.view"],
  seedMigration: "20260522142256_phase1_seed_missing_domains.sql",
  defaultRoute: "/dashboard/crm",
};

export default crmManifest;
