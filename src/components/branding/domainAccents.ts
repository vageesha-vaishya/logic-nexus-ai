/**
 * domainAccents — per-domain accent colors for the SOS umbrella chrome.
 *
 * The active product is expressed by a 4px accent strip + a small dot in
 * the membership-switcher pill. The chrome itself stays neutral SOS slate.
 * See docs/plans/2026-05-22-platform-brand-architecture-design.md §Color palette.
 *
 * Adding a domain: append a key here and the dot + strip pick it up
 * automatically. No CSS, no migration.
 *
 * Sthira-retail memberships intentionally have no accent — Sthira chrome
 * is the exception and lives in its own visual system.
 */

export type DomainAccentCode =
  | "logistics"
  | "markets"
  | "amro"
  | "banking"
  | "trading"
  | "insurance"
  | "customs"
  | "telecom"
  | "real_estate"
  | "ecommerce";

/** Concrete hex per domain. Maps to --domain-accent at runtime. */
export const DOMAIN_ACCENT_HEX: Readonly<Record<DomainAccentCode, string>> = {
  logistics:   "#1D4ED8",   // blue-700
  markets:     "#059669",   // emerald-600
  amro:        "#EA580C",   // orange-600
  banking:     "#4338CA",   // indigo-700
  trading:     "#DC2626",   // red-600
  insurance:   "#0D9488",   // teal-600
  customs:     "#D97706",   // amber-600
  telecom:     "#0891B2",   // cyan-600
  real_estate: "#57534E",   // stone-600
  ecommerce:   "#DB2777",   // pink-600
};

/** Default accent (SOS copper) used pre-auth or when no membership is active. */
export const DEFAULT_ACCENT_HEX = "#B45309";

export function accentForDomain(code: string | null | undefined): string {
  if (!code) return DEFAULT_ACCENT_HEX;
  return DOMAIN_ACCENT_HEX[code as DomainAccentCode] ?? DEFAULT_ACCENT_HEX;
}
