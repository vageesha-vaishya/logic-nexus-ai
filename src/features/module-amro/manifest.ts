/**
 * AMRO domain manifest (Aircraft Maintenance & Repair Operations).
 *
 * Phase 0 stub. Routes still registered in App.tsx today; Phase 2.2 will
 * migrate them. AMRO is the largest non-Markets domain — six tabs + an
 * extensive master-data settings tree. None mobile-eligible in Phase 0;
 * if a future mobile AMRO app appears, those flags flip per-route.
 *
 * See docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 */
import type { DomainManifest } from "@/platform/domains/types";

export const amroManifest: DomainManifest = {
  code: "AMRO",
  name: "Aircraft Maintenance & Repair Operations",
  description: "FAA/EASA/CAAC/SACAA-aware work orders, MPD, parts, directives.",
  brand: {
    cssVars: {},
    hybridWithTenantBranding: true,
  },
  routes: [],
  defaultAssignmentPolicy: "opt-in",
  requiredPermissions: ["amro.view"],
  seedMigration: "20260411000000_seed_amro_domain_and_assignments.sql",
};

export default amroManifest;
