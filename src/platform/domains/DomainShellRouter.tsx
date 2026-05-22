/**
 * DomainShellRouter — redirects single-domain tenants to their domain's
 * `defaultRoute` when they land on the generic dashboard.
 *
 * Phase 2 of the multi-domain independence sequence. A tenant who has only
 * the Markets domain assigned should boot into Markets, not the unified
 * Command Center dashboard. The "shell" here is the route — full per-domain
 * sidebar / dashboard components come later as each domain fleshes out its
 * manifest routes.
 *
 * Behaviour:
 *   - availableDomains.length === 1 and current pathname === '/dashboard'
 *     (or '/dashboard/' or '/') → Navigate to manifest.defaultRoute
 *   - multi-domain tenants, platform admins, or other paths → render
 *     children unchanged
 *   - DomainContext still loading → render children unchanged so we
 *     don't flash a redirect on the wrong frame
 *
 * Mount inside the `/dashboard` subtree so the redirect runs exactly once
 * per dashboard entry. Lifts no state — it's a pure routing decision based
 * on availableDomains + pathname.
 *
 * See docs/plans/2026-05-20-multi-domain-platform-sequence-design.md §A.
 */
import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useDomain } from "@/contexts/DomainContext";
import { getDomainManifest } from "./registry";

const SHELL_ENTRY_PATHS = new Set(["/", "/dashboard", "/dashboard/"]);

export interface DomainShellRouterProps {
  children: React.ReactNode;
}

export function DomainShellRouter({ children }: DomainShellRouterProps) {
  const { availableDomains, isPlatformAdmin, isLoading } = useDomain();
  const location = useLocation();
  const navigate = useNavigate();

  const target = useMemo(() => {
    // Don't redirect while we don't yet know the tenant's domain set —
    // the resolver kicks off after auth and resolves within ~100ms.
    if (isLoading) return null;
    // Platform admins see the full Command Center; they're tenant-agnostic.
    if (isPlatformAdmin) return null;
    // Multi-domain tenants stay on the generic dashboard.
    if (availableDomains.length !== 1) return null;
    if (!SHELL_ENTRY_PATHS.has(location.pathname)) return null;

    const onlyDomain = availableDomains[0];
    const manifest = getDomainManifest(onlyDomain.code);
    return manifest?.defaultRoute ?? null;
  }, [availableDomains, isLoading, isPlatformAdmin, location.pathname]);

  useEffect(() => {
    if (target) {
      navigate(target, { replace: true });
    }
  }, [target, navigate]);

  return <>{children}</>;
}
