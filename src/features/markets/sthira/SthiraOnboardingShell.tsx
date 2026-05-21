/**
 * SthiraOnboardingShell — full-screen layout for onboarding routes.
 *
 * Unlike MobileShell, this does NOT render the bottom tab bar — the user
 * hasn't earned navigation yet, they're committing to a single linear flow.
 *
 * Provides:
 *   - Cream background, safe-area-aware viewport
 *   - Optional progress dots at the top (e.g. risk-quiz step indicator)
 *   - A single scroll region for the active step's content
 */
import { cn } from "@/lib/utils";

export interface SthiraOnboardingShellProps {
  children: React.ReactNode;
  /** Optional pill-row progress indicator at the top. 1..n dots, `activeIndex` is 0-based. */
  totalSteps?:  number;
  activeIndex?: number;
  /** Page-level title shown above the progress dots. */
  title?: string;
  /** Optional small caps tag above the title — e.g. "STEP 2 OF 3". */
  eyebrow?: string;
}

export function SthiraOnboardingShell({
  children,
  totalSteps,
  activeIndex,
  title,
  eyebrow,
}: SthiraOnboardingShellProps) {
  return (
    <div
      className="
        relative min-h-screen w-full
        bg-sthira-cream text-sthira-ink font-sthiraSans
        flex flex-col
      "
      data-sthira-onboarding-shell
    >
      <div
        className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] flex-1 flex flex-col"
      >
        {(eyebrow || title || totalSteps) && (
          <header className="px-5 pt-8 pb-4 space-y-3">
            {totalSteps && totalSteps > 1 && (
              <div className="flex gap-1.5" aria-label={`Step ${(activeIndex ?? 0) + 1} of ${totalSteps}`}>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      i <= (activeIndex ?? 0) ? "bg-sthira-copper" : "bg-sthira-navy/15",
                    )}
                  />
                ))}
              </div>
            )}
            {eyebrow && (
              <p className="font-sthiraSans text-[11px] tracking-[0.18em] uppercase text-sthira-fog">
                {eyebrow}
              </p>
            )}
            {title && (
              <h1 className="font-sthiraSerif text-3xl text-sthira-ink leading-tight tabular-nums">
                {title}
              </h1>
            )}
          </header>
        )}
        <main className="flex-1 px-5 pb-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
