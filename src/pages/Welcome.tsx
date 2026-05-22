/**
 * Welcome — the signed-out branch screen for the unified onboarding.
 *
 * Three tiles for three audiences:
 *   1. Individual investor → /auth?intent=retail
 *        Sthira retail signup. Default dispatcher behaviour (no
 *        domain_code on raw_user_meta_data → retail) handles it.
 *   2. Register organization → /signup
 *        Domain picker (logistics / markets-advisor), built in U-A4.
 *   3. I have an invite link → /invite
 *        Tokenized invite accept, built in U-B2.
 *
 * Signed-in users never see this — RootRedirect punts them straight to
 * /dashboard. If a signed-in user navigates here directly we still let
 * them through (they may genuinely want to start a fresh org from the
 * same account); the multi-membership model supports that.
 *
 * See docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 */
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Mail, TrendingUp } from "lucide-react";

import { SosLogo } from "@/components/branding";

interface Tile {
  to:          string;
  icon:        typeof TrendingUp;
  eyebrow:     string;
  title:       string;
  description: string;
  cta:         string;
}

const TILES: readonly Tile[] = [
  {
    to:          "/auth?intent=retail",
    icon:        TrendingUp,
    eyebrow:     "For individuals",
    title:       "I'm an individual investor",
    description: "Open a free Sthira account. Paper-trade with ₹1,00,000 from day one; connect a real broker when you're ready.",
    cta:         "Open Sthira account",
  },
  {
    to:          "/signup",
    icon:        Building2,
    eyebrow:     "For businesses",
    title:       "Register an organization",
    description: "Logistics CRM or Markets-advisor tools. Free plan today, upgrade later. Invite your team after signup.",
    cta:         "Register organization",
  },
  {
    to:          "/invite",
    icon:        Mail,
    eyebrow:     "Joining a team",
    title:       "I have an invite link",
    description: "Paste the invite link or token you received. We'll add your account to your team in seconds.",
    cta:         "Accept invite",
  },
] as const;

export default function Welcome() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
        <header className="mb-10 flex flex-col items-center gap-3 text-center md:mb-14">
          <SosLogo size={56} />
          <p className="mt-2 text-xs uppercase tracking-[0.32em] text-muted-foreground">
            sosservices.online
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            How would you like to get started?
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
            SOS Services runs multiple products under one roof — pick the
            path that matches you. You can add more, switch contexts, or
            change accounts later from the menu.
          </p>
        </header>

        <ul className="grid gap-4 md:grid-cols-3">
          {TILES.map(({ to, icon: Icon, eyebrow, title, description, cta }) => (
            <li key={to}>
              <Link
                to={to}
                className="
                  group flex h-full flex-col rounded-xl border bg-card p-5
                  transition-colors hover:border-primary
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
                "
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {eyebrow}
                </p>
                <h2 className="mt-1 text-base font-semibold leading-tight">
                  {title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-snug text-muted-foreground">
                  {description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </footer>
      </div>
    </div>
  );
}
