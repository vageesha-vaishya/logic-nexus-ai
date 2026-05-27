/**
 * RootRedirect — what visitors see when they hit `sosservices.online/`.
 *
 * Native Capacitor shell (Sthira APK) → /sthira/splash regardless of auth.
 *     The splash itself runs useSthiraOnboardingProgress and routes to
 *     /auth, /sthira/onboarding, or /dashboard/markets/retail/home.
 * Web signed-out → /welcome (retail / register org / invite tiles).
 * Web signed-in  → /dashboard (existing post-login surface).
 *
 * Replaces the old marketing-style Landing page that used to sit at `/`.
 * Landing.tsx is preserved for the future graduation to a separate
 * marketing property; see docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 */
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

import { useAuth } from "@/hooks/useAuth";
import { useMemberships } from "@/hooks/useMemberships";

function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export default function RootRedirect() {
  const { user, loading: authLoading } = useAuth();
  const { memberships, hasExplicitActive, isLoading: membershipsLoading } =
    useMemberships();

  if (isNativeShell()) {
    return <Navigate to="/sthira/splash" replace />;
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/welcome" replace />;
  }

  // Wait for memberships to load before deciding between dashboard and
  // chooser — premature routing would either skip the chooser
  // (memberships not yet known) or send single-membership users into
  // an empty loading-state chooser.
  if (membershipsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Multi-membership users with no explicit active row land on the
  // login-time chooser. Once they pick, switchTo writes the row and
  // bounces back through "/" — RootRedirect re-runs, hasExplicitActive
  // is now true, and they proceed to /dashboard. Closes the audience-
  // guard trap that bit the operator on 2026-05-27 by giving every
  // multi-membership user an explicit landing decision.
  if (memberships.length >= 2 && !hasExplicitActive) {
    return <Navigate to="/auth/choose-account" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
