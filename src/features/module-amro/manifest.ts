/**
 * AMRO domain manifest (Aircraft Maintenance & Repair Operations).
 *
 * Owns the FAA / EASA / CAAC / SACAA-aware MRO surface — work orders,
 * MPD, parts, configured directives, templates, master data.
 *
 * AMRO is currently sales-led (not self-serve in v1 per
 * docs/plans/2026-05-22-unified-platform-onboarding-design.md Q3-A).
 * The manifest is still present so existing AMRO tenants get the same
 * grouped sidebar + per-domain accent treatment as the self-serve
 * products.
 *
 * Phase 0 stub for routing — full route metadata gets fleshed out by
 * MV-3 (sidebar refactor) and MV-4 (ProtectedRoute refactor).
 *
 * See docs/plans/2026-05-22-module-visibility-and-domain-login-design.md.
 */
import { Plane } from "lucide-react";

import type { DomainManifest } from "@/platform/domains/types";

export const amroManifest: DomainManifest = {
  code: "AMRO",
  name: "AMRO",
  description: "FAA / EASA / CAAC / SACAA-aware work orders, MPD, parts, directives.",
  brand: {
    cssVars: {},
    hybridWithTenantBranding: true,
  },

  // Path prefixes the resolveActiveDomain() function matches against
  // to decide "the user is in AMRO now". The /dashboard/amro tree
  // covers every AMRO surface today (work orders, MPD, parts,
  // settings). None mobile-eligible in Phase 0; if a future mobile
  // AMRO app appears, route-level flags flip per route.
  pathPrefixes: ["/dashboard/amro"],
  sidebar: {
    label: "AMRO",
    icon:  Plane,
  },

  routes: [],
  defaultAssignmentPolicy: "opt-in",
  requiredPermissions: ["amro.view"],
  seedMigration: "20260411000000_seed_amro_domain_and_assignments.sql",
};

export default amroManifest;
