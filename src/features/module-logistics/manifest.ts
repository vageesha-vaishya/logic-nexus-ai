/**
 * Logistics domain manifest.
 *
 * Owns the B2B "SOS Logistics" product surface — CRM-style account /
 * contact / lead / opportunity / quotation / shipment management.
 * Self-serve domain per
 * docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 *
 * Phase 0 stub for routing — full route metadata gets fleshed out by
 * MV-3 (sidebar refactor) and MV-4 (ProtectedRoute refactor). What this
 * manifest declares today:
 *   - pathPrefixes for resolveActiveDomain (URL → domain lookup)
 *   - sidebar group label + icon for the tenant-wide grouped sidebar
 *
 * See docs/plans/2026-05-22-module-visibility-and-domain-login-design.md.
 */
import { Building2 } from "lucide-react";

import type { DomainManifest } from "@/platform/domains/types";

export const logisticsManifest: DomainManifest = {
  code: "LOGISTICS",
  name: "Logistics",
  description: "Lead capture, opportunities, quotations, shipments, carriers.",
  brand: { cssVars: {}, hybridWithTenantBranding: true },

  // Path prefixes the resolveActiveDomain() function matches against
  // to decide "the user is in Logistics now". Covers the CRM-style
  // routes currently hand-declared in App.tsx (accounts / contacts /
  // leads / opportunities / quotations) — all of which live under
  // the logistics platform domain semantically. Phase 2.2 of the
  // multi-domain sequence (when App.tsx routes migrate to
  // manifest-driven mounting) will let us shorten this list.
  pathPrefixes: [
    "/dashboard/logistics",
    "/dashboard/accounts",
    "/dashboard/contacts",
    "/dashboard/leads",
    "/dashboard/opportunities",
    "/dashboard/quotations",
    "/dashboard/shipments",
    "/dashboard/carriers",
    "/dashboard/transport-modes",
  ],
  sidebar: {
    label: "Logistics",
    icon:  Building2,
  },

  routes: [],
  defaultAssignmentPolicy: "opt-in",
  requiredPermissions: ["logistics.view"],
  seedMigration: "20260131053539_sync_logistics_domain.sql",
};

export default logisticsManifest;
