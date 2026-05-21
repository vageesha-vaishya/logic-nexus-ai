/**
 * Domain registry — the single import surface for every domain manifest.
 *
 * Phase 0 of the multi-domain independence sequence. Adding a new domain
 * is: write `manifest.ts` in your feature module, add the import here,
 * push to the `DOMAIN_MANIFESTS` array. The lint script in
 * `scripts/lint-domain-manifests.mjs` enforces that every domain dir
 * under `src/features/` has a corresponding entry here.
 *
 * Phase 2.2 will refactor App.tsx to read from this registry rather than
 * hand-declaring every <Route>. Phase 2.3 then introduces per-domain
 * Vite entrypoints that import just one manifest (Sthira = Markets only).
 *
 * See:
 *   docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 *   src/platform/domains/types.ts
 */

import type { DomainManifest } from "./types";

import { marketsManifest } from "@/features/markets/manifest";
import { amroManifest } from "@/features/module-amro/manifest";
import { communicationsManifest } from "@/features/module-communications/manifest";
import { complianceManifest } from "@/features/module-compliance/manifest";
import { crmManifest } from "@/features/module-crm/manifest";
import { financeManifest } from "@/features/module-finance/manifest";
import { logisticsManifest } from "@/features/module-logistics/manifest";
import { quotationManifest } from "@/features/module-quotation/manifest";

export const DOMAIN_MANIFESTS: readonly DomainManifest[] = [
  marketsManifest,
  amroManifest,
  communicationsManifest,
  complianceManifest,
  crmManifest,
  financeManifest,
  logisticsManifest,
  quotationManifest,
] as const;

/** Look up a manifest by code. Case-insensitive — matches DB norm. */
export function getDomainManifest(code: string): DomainManifest | null {
  const normalised = code.trim().toUpperCase();
  return (
    DOMAIN_MANIFESTS.find((m) => m.code.toUpperCase() === normalised) ?? null
  );
}

/**
 * Filter manifests to those the current viewer is allowed to see, given
 * a set of permission strings. Used at Phase 2.2 when building the
 * runtime route tree.
 */
export function visibleManifests(
  manifests: readonly DomainManifest[],
  userPermissions: ReadonlySet<string>,
): readonly DomainManifest[] {
  return manifests.filter((m) => {
    if (!m.requiredPermissions || m.requiredPermissions.length === 0) return true;
    return m.requiredPermissions.every((p) => userPermissions.has(p));
  });
}
