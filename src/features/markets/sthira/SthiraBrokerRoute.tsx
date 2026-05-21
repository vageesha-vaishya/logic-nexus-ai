/**
 * SthiraBrokerRoute — final onboarding step: connect a broker (skippable).
 *
 * PR 2 renders a concise card explaining the value of connecting Groww and
 * provides two paths:
 *   - "Connect Groww" — deep-links to the existing
 *     /dashboard/markets/settings/brokers page where the live ConnectSheet
 *     handles the actual key entry + access-token round-trip.
 *   - "Skip — explore in paper mode" — proceeds straight to Home. The user
 *     can connect a broker any time from the You tab later.
 *
 * Both paths end at /dashboard/markets/retail/home so the existing user
 * journey takes over from there.
 *
 * A future PR (4) will inline the connect flow as a bottom sheet on this
 * route instead of bouncing to settings, and bake in real biometric gating.
 */
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SthiraOnboardingShell } from "./SthiraOnboardingShell";

export default function SthiraBrokerRoute() {
  const navigate = useNavigate();
  const goHome = () => navigate("/dashboard/markets/retail/home", { replace: true });

  return (
    <SthiraOnboardingShell
      eyebrow="Step 2 of 2"
      title="Connect a broker"
    >
      <div className="space-y-6 pt-2">
        <p className="text-sm text-sthira-fog leading-relaxed">
          Connecting a broker lets Sthira sync your holdings, generate
          personalised signals, and place one-tap trades. You can skip and
          explore in paper mode — connect any time from the <em>You</em> tab.
        </p>

        <div className="rounded-xl border border-sthira-navy/15 bg-white/50 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-sthiraSerif text-xl">Groww</span>
            <span className="text-[10px] tracking-widest uppercase text-sthira-fog">
              Trade API
            </span>
          </div>
          <p className="text-xs text-sthira-fog leading-relaxed">
            We'll pull your holdings — no trading happens until you allow it.
            Groww requires a quick daily approval.
          </p>
          <Button
            asChild
            className="w-full bg-sthira-copper text-sthira-cream hover:bg-sthira-copper/90"
          >
            <Link to="/dashboard/markets/settings/brokers">Connect Groww</Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={goHome}
          className="block w-full text-center text-sm font-medium text-sthira-fog underline-offset-4 hover:underline"
        >
          Skip — explore in paper mode
        </button>
      </div>
    </SthiraOnboardingShell>
  );
}
