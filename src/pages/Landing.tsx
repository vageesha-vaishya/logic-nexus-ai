import { Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";

function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const Landing = () => {
  // Native shell (Sthira APK) must never see the SOS Logistics marketing
  // surface — it's a retail mobile app, not a B2B logistics landing page.
  if (isNativeShell()) {
    return <Navigate to="/sthira/splash" replace />;
  }
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturesSection />
    </div>
  );
};

export default Landing;
