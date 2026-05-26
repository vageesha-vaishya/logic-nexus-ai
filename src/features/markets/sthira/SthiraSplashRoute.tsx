/**
 * SthiraSplashRoute — entry point for the Sthira mobile flow.
 *
 * 1. On mount, fires hideSthiraSplash() so the native Capacitor splash hands
 *    off cleanly to this React-rendered splash.
 * 2. Queries useSthiraOnboardingProgress to find out which step the user
 *    needs next.
 * 3. Redirects accordingly:
 *      auth     -> /auth (existing web auth route)
 *      risk     -> /sthira/onboarding
 *      broker   -> /sthira/broker
 *      complete -> /dashboard/markets/retail/home
 *
 * While the hook returns "loading", the splash visual stays put. A 4s
 * watchdog (only armed while step === "loading") redirects to the retail
 * Home, where SthiraMobileGuard re-runs the routing decision. Stays inside
 * the Sthira shell so a stuck user never sees CRM branding. The cleanup
 * clears the timer the moment step resolves, so a slow-but-eventually-
 * successful resolution never races into the wrong redirect.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { hideSthiraSplash } from "@/lib/sthira-splash";
import { useSthiraOnboardingProgress } from "./useSthiraOnboardingProgress";

const WATCHDOG_MS = 4000;

const NEXT_PATH: Record<string, string> = {
  // ?intent=retail flips Auth.tsx to SthiraChrome (cream + copper + serif)
  // instead of SosChrome (CRM-branded). ?next routes the post-login user
  // back through this splash so it re-evaluates onboarding state — without
  // it the default `/dashboard` takes them straight into CRM.
  auth:     "/auth?intent=retail&next=/sthira/splash",
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

  // Watchdog: if step is still "loading" after 4s (auth/profile query hung),
  // fall through to the retail Home — SthiraMobileGuard there re-runs the
  // routing decision and either renders Home (queries resolved by then) or
  // bounces back to this splash. Stays inside the Sthira shell, never lands
  // on the CRM-branded /auth. The effect cleanup clears the timer the moment
  // step resolves, avoiding a race where the watchdog and the resolved
  // redirect both fire.
  useEffect(() => {
    if (step !== "loading") return;
    const t = window.setTimeout(() => {
      navigate("/dashboard/markets/retail/home", { replace: true });
    }, WATCHDOG_MS);
    return () => window.clearTimeout(t);
  }, [step, navigate]);

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
