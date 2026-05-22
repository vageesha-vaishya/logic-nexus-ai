/**
 * DomainMarketingIcon — per-domain marketing icon (rounded square +
 * monoline pictogram). One family for all 10 active platform_domains.
 *
 * Per the design brief
 * (docs/plans/2026-05-22-brand-logos-design-brief.md §Per-domain icons):
 * each icon lives in the same rounded-square container as the SOS master,
 * with a monoline pictogram inside. Two color variants — "color"
 * (domain accent fill + white pictogram) and "mono" (--sos-ink fill +
 * white pictogram).
 *
 * Placeholders today: pictograms borrowed from lucide-react which uses
 * the same monoline visual language we'd commission. When the
 * commissioned per-domain SVGs land, swap the import map below for
 * direct SVG imports — no other code touches this component.
 *
 * Marketing-use only (Q1-C in the brand brief). In-app surfaces stay on
 * the SOS master mark per BR0.
 */
import {
  ArrowLeftRight,
  Building2,
  Home,
  Landmark,
  Plane,
  Radio,
  ShoppingBag,
  TrendingUp,
  Truck,
  Umbrella,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { accentForDomain, type DomainAccentCode } from "./domainAccents";

type DomainIconConfig = {
  icon:      LucideIcon;
  /** Aria label spoken to assistive tech when the icon stands alone. */
  ariaLabel: string;
};

/**
 * Domain → icon mapping. Adding a domain: append here, no other change
 * needed. Replacing a placeholder with the commissioned SVG: swap the
 * `icon` value here for a custom component.
 */
const DOMAIN_ICONS: Readonly<Record<DomainAccentCode, DomainIconConfig>> = {
  logistics:   { icon: Truck,          ariaLabel: "SOS Logistics" },
  markets:     { icon: TrendingUp,     ariaLabel: "SOS Markets Advisor" },
  amro:        { icon: Plane,          ariaLabel: "SOS AMRO" },
  banking:     { icon: Landmark,       ariaLabel: "SOS Banking" },
  trading:     { icon: ArrowLeftRight, ariaLabel: "SOS Trading" },
  insurance:   { icon: Umbrella,       ariaLabel: "SOS Insurance" },
  customs:     { icon: Building2,      ariaLabel: "SOS Customs" }, // chevron-gate placeholder — see brief Q9
  telecom:     { icon: Radio,          ariaLabel: "SOS Telecom" },
  real_estate: { icon: Home,           ariaLabel: "SOS Real Estate" },
  ecommerce:   { icon: ShoppingBag,    ariaLabel: "SOS E-commerce" },
};

export interface DomainMarketingIconProps {
  domain:    DomainAccentCode;
  /** Square edge length in pixels. Default 64. */
  size?:     number;
  /**
   * "color" = domain accent fill + white pictogram (marketing default).
   * "mono"  = --sos-ink fill + white pictogram.
   */
  variant?:  "color" | "mono";
  className?: string;
}

const SOS_INK = "#0F172A";

export function DomainMarketingIcon({
  domain,
  size      = 64,
  variant   = "color",
  className,
}: DomainMarketingIconProps) {
  const config = DOMAIN_ICONS[domain];
  if (!config) {
    // eslint-disable-next-line no-console
    console.warn(`DomainMarketingIcon: unknown domain "${domain}"`);
    return null;
  }

  const Icon       = config.icon;
  const bg         = variant === "color" ? accentForDomain(domain) : SOS_INK;
  const iconStroke = "white";
  // Pictogram takes the central 60% of the square — same proportion as
  // the SOS master letterform inside its container.
  const iconSize   = Math.round(size * 0.6);

  return (
    <div
      role="img"
      aria-label={config.ariaLabel}
      className={cn(
        "shrink-0 inline-flex items-center justify-center rounded-2xl",
        className,
      )}
      style={{
        width:  size,
        height: size,
        background: bg,
        borderRadius: Math.round(size * 0.1875), // ~18.75% per brief
      }}
    >
      <Icon
        size={iconSize}
        strokeWidth={1.75}
        color={iconStroke}
        aria-hidden="true"
      />
    </div>
  );
}

export default DomainMarketingIcon;

export const DOMAIN_ICON_LIST = Object.keys(DOMAIN_ICONS) as DomainAccentCode[];
