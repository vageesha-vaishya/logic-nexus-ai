/**
 * SignupDomainPicker — step 0 of the B2B signup flow.
 *
 * Two tiles, one per self-serve domain (decision Q3-A). Picking one routes
 * to /signup/[domain] where the single-form wizard collects email + password
 * + org name + country and triggers Supabase signup.
 *
 * Companion of /welcome (which picked B2B over retail/invite). Future
 * domains (AMRO, Banking, Trading, …) come online by extending
 * SIGNUP_DOMAINS in ./types.ts — no code changes here required.
 */
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, TrendingUp } from "lucide-react";

import { SosLogo } from "@/components/branding";
import { SIGNUP_DOMAIN_LIST, type SignupDomain } from "./types";

const ICONS: Record<SignupDomain, typeof Building2> = {
  logistics: Building2,
  markets:   TrendingUp,
};

export default function SignupDomainPicker() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/welcome"
            className="
              inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground
              focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded
            "
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <SosLogo size={36} />
        </div>

        <header className="mt-6 mb-10 space-y-2 md:mb-12">
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Register an organization on SOS Services
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Which product are you signing up for?
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Pick one to start — you can add the other to your tenant later
            from Settings → Billing.
          </p>
        </header>

        <ul className="grid gap-4 md:grid-cols-2">
          {SIGNUP_DOMAIN_LIST.map(({ code, name, tagline, bullets }) => {
            const Icon = ICONS[code];
            return (
              <li key={code}>
                <Link
                  to={`/signup/${code}`}
                  className="
                    group flex h-full flex-col rounded-xl border bg-card p-6
                    transition-colors hover:border-primary
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
                  "
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold leading-tight">{name}</h2>
                  <p className="mt-2 text-sm leading-snug text-muted-foreground">
                    {tagline}
                  </p>
                  <ul className="mt-4 flex-1 space-y-1 text-xs text-muted-foreground">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span aria-hidden="true" className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Continue
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Need something else — AMRO, Banking, Trading, Insurance?{" "}
          <a
            href="mailto:sales@sosservices.online"
            className="font-medium text-foreground hover:underline"
          >
            Talk to sales
          </a>
        </footer>
      </div>
    </div>
  );
}
