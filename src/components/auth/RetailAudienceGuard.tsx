/**
 * RetailAudienceGuard — wraps the router so retail-only users cannot
 * navigate outside the Sthira surface.
 *
 * When the active membership is the Sthira retail entry (is_retail) AND
 * the current path isn't in the allow-list, silently redirect to
 * /dashboard/markets/retail/home. SthiraMobileGuard there re-routes
 * appropriately based on onboarding state.
 *
 * Deliberately a silent Navigate rather than a 403 page — a misclick or
 * deep-link from a stale notification should land the user on Home, not
 * a scary error screen. We log to the project logger so we can spot
 * patterns of retail users hitting blocked routes.
 *
 * NOT gated on useSthiraShell(): a retail user on responsive web (e.g.
 * tablet) should still be locked to the Sthira routes. Audience > shell.
 */
import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useIsRetailOnly } from "@/hooks/useIsRetailOnly";
import { logger } from "@/lib/logger";

const RETAIL_HOME = "/dashboard/markets/retail/home";

// Paths a retail user is allowed to reach. Anything else under
// /dashboard/* triggers a redirect.
//
// Auth + Sthira-shell routes are unguarded (a signed-out user, the
// splash, the onboarding wizard, and the welcome page must always
// resolve). Retail subtree + the markets routes the Sthira UI links
// into (broker connection, instrument detail, portfolio detail,
// signals deep-links) are explicitly allowed.
const RETAIL_ALLOWED: ReadonlyArray<RegExp> = [
  /^\/$/,                                          // RootRedirect
  /^\/auth(?:\?|$)/,                               // sign-in / sign-up
  /^\/welcome(?:\?|$)/,                            // public landing
  /^\/sthira\//,                                   // splash, onboarding, broker
  /^\/onboarding(?:\?|$)/,                         // /onboarding alias
  /^\/dashboard\/markets\/retail(?:\/|$|\?)/,      // 5-tab retail subtree
  /^\/dashboard\/markets\/portfolios(?:\/|$|\?)/,  // tier-card detail
  /^\/dashboard\/markets\/settings\/brokers/,      // broker connection flow
  /^\/dashboard\/markets\/instruments\//,          // signal-driven detail
  /^\/dashboard\/markets\/signals(?:\?|$)/,        // signals index
  /^\/dashboard\/markets\/mf(?:\/|$|\?)/,          // mutual funds (retail-safe surface, mobile variant)
  /^\/dashboard\/markets\/watchlists(?:\/|$|\?)/,  // watchlists index + detail (retail-safe — user-scoped, no advisor concept)
  /^\/legal\//,                                    // T&C / privacy / disclosures
  /^\/methodology\//,                              // public methodology pages
];

function isAllowedForRetail(pathname: string): boolean {
  return RETAIL_ALLOWED.some((re) => re.test(pathname));
}

export function RetailAudienceGuard({ children }: { children: React.ReactNode }) {
  const isRetail = useIsRetailOnly();
  const location = useLocation();
  const blocked  = isRetail && !isAllowedForRetail(location.pathname);

  useEffect(() => {
    if (blocked) {
      logger.info("[RetailAudienceGuard] redirecting retail user from blocked path", {
        from: location.pathname,
      });
    }
  }, [blocked, location.pathname]);

  if (blocked) return <Navigate to={RETAIL_HOME} replace />;
  return <>{children}</>;
}
