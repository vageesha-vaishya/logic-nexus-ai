/**
 * RootRedirect — what visitors see when they hit `sosservices.online/`.
 *
 * Signed-out → /welcome (three-tile branch: retail / register org / invite).
 * Signed-in  → /dashboard (the existing post-login surface; once the topbar
 *              context switcher lands in U-A5 it routes from there to the
 *              user's last-used membership).
 *
 * Replaces the old marketing-style Landing page that used to sit at `/`.
 * Landing.tsx is preserved for the future graduation to a separate
 * marketing property; see docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 */
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

export default function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Navigate to={user ? "/dashboard" : "/welcome"} replace />;
}
