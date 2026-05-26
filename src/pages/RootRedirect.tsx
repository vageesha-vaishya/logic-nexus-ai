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

function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export default function RootRedirect() {
  const { user, loading } = useAuth();

  if (isNativeShell()) {
    return <Navigate to="/sthira/splash" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Navigate to={user ? "/dashboard" : "/welcome"} replace />;
}
