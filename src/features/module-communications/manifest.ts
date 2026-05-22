/**
 * Communications domain manifest. Phase 0 stub.
 * See docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 */
import type { DomainManifest } from "@/platform/domains/types";

export const communicationsManifest: DomainManifest = {
  code: "COMMUNICATIONS",
  name: "Communications",
  description: "Email, SMS, WhatsApp, in-app messaging, multi-channel.",
  brand: { cssVars: {}, hybridWithTenantBranding: true },
  routes: [],
  defaultAssignmentPolicy: "auto",
  requiredPermissions: ["communications.view"],
  seedMigration: "20260522142256_phase1_seed_missing_domains.sql",
};

export default communicationsManifest;
