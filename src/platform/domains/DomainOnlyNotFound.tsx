/**
 * Fallback rendered when a domain-only build (e.g. Sthira = Markets-only)
 * receives a request for a route that lives in another domain.
 *
 * In a unified web build this never renders — the route hits its
 * hand-declared <Route>. In a domain-only build (VITE_DOMAIN_ONLY=markets),
 * the hand-declared blocks for other domains are skipped entirely, so any
 * URL outside the Markets manifest lands here.
 *
 * Visual is intentionally simple: this isn't a crash, it's a user choosing
 * a desktop-only feature on a phone. The "Back to home" CTA returns them
 * to a known-good route in the active domain.
 */
import { Link } from "react-router-dom";

import { RetailBottomNav } from "@/features/markets/retail/layouts/RetailNavLayout";
import { useIsRetailOnly } from "@/hooks/useIsRetailOnly";

import { DOMAIN_ONLY } from "./buildDomainRoutes";

export function DomainOnlyNotFound() {
  const friendly = DOMAIN_ONLY ? DOMAIN_ONLY.toUpperCase() : "this domain";
  const isRetail = useIsRetailOnly();
  return (
    <>
      {/* Reserve room for the bottom nav so the CTA isn't trapped beneath it. */}
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-sthira-cream px-6 pb-24 md:pb-6 md:pl-20 text-center">
        <h1 className="font-sthiraSerif text-3xl text-sthira-ink">Not available here</h1>
        <p className="max-w-sm text-sm text-sthira-fog">
          This page is part of a different module. You're on the {friendly} build,
          which ships only the routes designed for this experience.
        </p>
        <Link
          to="/dashboard/markets/retail/home"
          className="mt-4 inline-block rounded-md bg-sthira-copper px-5 py-2 text-sm font-medium text-sthira-cream hover:bg-sthira-copper/90"
        >
          Back to home
        </Link>
      </div>
      {isRetail && <RetailBottomNav />}
    </>
  );
}

export default DomainOnlyNotFound;
