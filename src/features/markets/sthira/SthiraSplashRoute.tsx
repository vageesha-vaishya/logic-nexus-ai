/**
 * SthiraSplashRoute — entry point for the Sthira mobile flow.
 *
 * 1. On mount, fires hideSthiraSplash() so the native Capacitor splash hands
 *    off cleanly to this React-rendered splash.
 * 2. Queries useSthiraOnboardingProgress to find out which step the user
 *    needs next.
 * 3. Redirects accordingly:
 *      auth     -> /auth/login (existing web auth)
 *      risk     -> /sthira/onboarding
 *      broker   -> /sthira/broker
 *      complete -> /dashboard/markets/retail/home
 *
 * While the hook returns "loading", the splash visual stays put. A 4s
 * watchdog redirects to /dashboard on the assumption that something is
 * stuck (covers the rare case where Supabase auth state never resolves).
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { hideSthiraSplash } from "@/lib/sthira-splash";
import { useSthiraOnboardingProgress } from "./useSthiraOnboardingProgress";

const WATCHDOG_MS = 4000;

const NEXT_PATH: Record<string, string> = {
  auth:     "/auth/login",
  risk:     "/sthira/onboarding",
  broker:   "/sthira/broker",
  complete: "/dashboard/markets/retail/home",
};

export default function SthiraSplashRoute() {
  const navigate = useNavigate();
  const { step } = useSthiraOnboardingProgress();

  useEffect(() => {
    void hideSthiraSplash();
  }, []);

  useEffect(() => {
    if (step === "loading") return;
    const dest = NEXT_PATH[step];
    if (dest) navigate(dest, { replace: true });
  }, [step, navigate]);

  // Watchdog: if we're still showing the splash after 4s (something hung),
  // fall through to the dashboard rather than leaving the user stranded.
  useEffect(() => {
    const t = window.setTimeout(() => {
      navigate("/dashboard/markets/retail/home", { replace: true });
    }, WATCHDOG_MS);
    return () => window.clearTimeout(t);
  }, [navigate]);

  return (
    <div
      className="
        fixed inset-0 z-50
        bg-sthira-navy text-sthira-cream
        flex flex-col items-center justify-center
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
      "
      data-sthira-splash
      aria-busy="true"
      aria-live="polite"
    >
      <h1 className="font-sthiraSerif text-5xl text-sthira-copper">Sthira</h1>
      <p className="mt-3 text-[11px] tracking-[0.32em] uppercase text-sthira-cream/70">
        Steady Wealth
      </p>
    </div>
  );
}
