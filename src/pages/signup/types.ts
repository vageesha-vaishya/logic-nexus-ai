/**
 * Domain codes the B2B signup wizard supports. Mirrors the dispatcher
 * branching in supabase/functions/provision-retail-user/index.ts and the
 * v1 self-serve domains locked in
 * docs/plans/2026-05-22-unified-platform-onboarding-design.md (Q3-A).
 */
export type SignupDomain = "logistics" | "markets";

export interface DomainBrochure {
  code:        SignupDomain;
  name:        string;
  tagline:     string;
  bullets:     readonly string[];
  /**
   * Word for what the org calls itself in copy — "company" / "firm" / etc.
   * Drives the org-name placeholder and surrounding microcopy on the form.
   */
  orgNoun:     string;
}

export const SIGNUP_DOMAINS: Readonly<Record<SignupDomain, DomainBrochure>> = {
  logistics: {
    code:    "logistics",
    name:    "Logistics CRM",
    tagline: "Capture leads from every channel, run a clean opportunity pipeline, and invoice with GST built in.",
    bullets: [
      "WhatsApp, email, Telegram lead capture",
      "Quotations, contracts, and invoices",
      "Multi-franchise + role-based access",
    ],
    orgNoun: "company",
  },
  markets: {
    code:    "markets",
    name:    "Markets Advisor",
    tagline: "Wealthfront-grade risk scoring and signal feeds for advisory firms. Start with paper portfolios; connect a broker later.",
    bullets: [
      "Per-advisor portfolios + risk scoring",
      "SEBI-aligned compliance fields when you go live",
      "10–12 question risk profiling for every client",
    ],
    orgNoun: "firm",
  },
};

export const SIGNUP_DOMAIN_LIST: readonly DomainBrochure[] = [
  SIGNUP_DOMAINS.logistics,
  SIGNUP_DOMAINS.markets,
];

/** Type guard for the URL param. */
export function isSignupDomain(s: string | undefined | null): s is SignupDomain {
  return s === "logistics" || s === "markets";
}
