/**
 * SthiraMobileGuard — wraps the markets retail dashboard route.
 *
 * On mobile (useSthiraShell):
 *   - Onboarding incomplete → redirect to /sthira/splash (which itself
 *     decides the next concrete step).
 *   - Fully onboarded → render the Sthira mobile Home tab.
 *
 * On desktop / wide viewports:
 *   - Pass through to the existing retail home (web layout).
 *
 * This is the seam that activates the Sthira flow without forking the
 * router by client type. The desktop experience is untouched.
 */
import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";

import { useSthiraShell } from "@/hooks/use-sthira-shell";
import { useSthiraOnboardingProgress } from "./useSthiraOnboardingProgress";

const HomeMobilePage = lazy(() => import("./HomeMobilePage"));

interface SthiraMobileGuardProps {
  /** What to render on desktop (or when the user is fully onboarded but
      not on mobile) — the existing web retail home. */
  fallback: React.ReactNode;
}

export function SthiraMobileGuard({ fallback }: SthiraMobileGuardProps) {
  const isSthiraShell = useSthiraShell();
  const progress = useSthiraOnboardingProgress();

  if (!isSthiraShell) {
    return <>{fallback}</>;
  }

  if (progress.step === "loading") {
    // Hold on cream background while the queries resolve — keeps the
    // transition from splash → home from flashing the desktop layout.
    return (
      <div className="min-h-screen w-full bg-sthira-cream" data-sthira-loading aria-busy="true" />
    );
  }

  if (progress.step !== "complete") {
    return <Navigate to="/sthira/splash" replace />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-sthira-cream" aria-busy="true" />}>
      <HomeMobilePage />
    </Suspense>
  );
}
