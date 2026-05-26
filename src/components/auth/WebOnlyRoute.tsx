/**
 * WebOnlyRoute — block a route from the Sthira native shell.
 *
 * Wraps any route that is part of the SOS B2B audience (the marketing
 * landing, the audience picker, the org signup, the invite-accept form,
 * the platform-admin bootstrap). On the Capacitor APK we redirect into
 * the Sthira flow via /sthira/splash, which routes to /auth?intent=retail
 * or onboarding/home based on session state.
 *
 * Web behaviour is untouched — desktop / mobile-web visitors see the
 * wrapped content normally. The check is one shot at mount: native vs
 * web doesn't change at runtime.
 */
import { Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function WebOnlyRoute({ children }: { children: React.ReactNode }) {
  if (isNativeShell()) {
    return <Navigate to="/sthira/splash" replace />;
  }
  return <>{children}</>;
}
