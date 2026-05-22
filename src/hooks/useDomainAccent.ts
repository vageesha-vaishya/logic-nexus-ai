/**
 * useDomainAccent — set --domain-accent on :root from the active membership.
 *
 * Mount once at the top of DashboardLayout. Reads activeMembership.domain_code
 * via useMemberships() and writes a hex color to document.documentElement
 * style. Sthira retail memberships fall back to the default SOS copper
 * (the accent strip is hidden for them anyway).
 *
 * Pre-auth surfaces (welcome, auth, signup, invite) don't call this hook —
 * --domain-accent defaults to --sos-copper via the CSS variable.
 *
 * See docs/plans/2026-05-22-platform-brand-architecture-design.md.
 */
import { useEffect } from "react";

import { useMemberships } from "@/hooks/useMemberships";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { accentForDomain, DEFAULT_ACCENT_HEX } from "@/components/branding/domainAccents";

const HEX_RE = /^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

function normalizeHex(s: string | null | undefined): string | null {
  if (!s) return null;
  const v = s.trim();
  if (!HEX_RE.test(v)) return null;
  return v.startsWith("#") ? v : `#${v}`;
}

export function useDomainAccent(): string {
  const { activeMembership } = useMemberships();
  const { branding } = useTenantBranding();

  // Tenant override wins over per-domain default. Retail memberships
  // always fall back to the default (Sthira chrome is sacred per BR-4).
  const tenantOverride = activeMembership?.is_retail
    ? null
    : normalizeHex(branding?.accentColor);

  const hex = tenantOverride
    ?? (activeMembership?.is_retail
      ? DEFAULT_ACCENT_HEX
      : accentForDomain(activeMembership?.domain_code ?? null));

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--domain-accent", hex);
    return () => {
      // Reset to the CSS-default fallback on unmount so post-logout
      // surfaces don't inherit a stale tint.
      document.documentElement.style.removeProperty("--domain-accent");
    };
  }, [hex]);

  return hex;
}
