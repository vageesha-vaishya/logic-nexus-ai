/**
 * SthiraMonogram — small-surface mark for Sthira (favicon, app icon,
 * push notification, social profile, anywhere the full wordmark is too
 * big).
 *
 * Per the design brief
 * (docs/plans/2026-05-22-brand-logos-design-brief.md §Sthira monogram):
 * a serif "S" lifted from the Sthira wordmark, keeping the thick-thin
 * stroke contrast so the eye can never confuse it with the SOS master
 * monoweight "S". Placeholder uses CSS-rendered serif type; swap the
 * inner glyph for the commissioned SVG when delivered.
 *
 * The full Sthira wordmark (sthira-name on cream background, used for
 * headers + marketing) is a separate concern — preserved as-is per Q8
 * of the brand brief.
 */
import { cn } from "@/lib/utils";

interface SthiraMonogramProps {
  /** Square edge length in pixels. Default 40. */
  size?:     number;
  /**
   * "default" = copper S on cream background (warm, primary use).
   * "reverse" = cream S on navy background (dark surfaces / push).
   */
  variant?:  "default" | "reverse";
  /**
   * Whether to render the rounded-square container. Off by default —
   * use for transparent placements (next to other type). Turn on for
   * app icons and standalone favicons.
   */
  withContainer?: boolean;
  className?:     string;
}

export function SthiraMonogram({
  size           = 40,
  variant        = "default",
  withContainer  = true,
  className,
}: SthiraMonogramProps) {
  const isReverse = variant === "reverse";

  const bg     = isReverse ? "hsl(var(--sthira-navy))"  : "hsl(var(--sthira-cream))";
  const fg     = isReverse ? "hsl(var(--sthira-cream))" : "hsl(var(--sthira-copper))";

  return (
    <div
      role="img"
      aria-label="Sthira"
      className={cn(
        "shrink-0 inline-flex items-center justify-center select-none",
        withContainer && "rounded-2xl",
        className,
      )}
      style={{
        width:  size,
        height: size,
        background:   withContainer ? bg : "transparent",
        borderRadius: withContainer ? Math.round(size * 0.1875) : undefined,
        color:        fg,
        fontFamily:   'var(--font-sthira-serif, "Fraunces", "Cambria", ui-serif, Georgia, serif)',
        fontSize:     Math.round(size * 0.62),
        fontWeight:   600,
        letterSpacing: "-0.02em",
        // Optical alignment — most serif S's sit slightly above the
        // baseline visual center. The translateY nudges it back.
        lineHeight: 1,
        paddingBottom: Math.round(size * 0.04),
      }}
    >
      S
    </div>
  );
}

export default SthiraMonogram;
