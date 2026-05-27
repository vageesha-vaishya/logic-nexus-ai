/**
 * SignupForm — single-form B2B signup (decision Q10-D).
 *
 * Lives at /signup/[domain]. Collects email + password + org name +
 * country and calls supabase.auth.signUp via useAuth().signUp helper,
 * passing { domain_code, org_name, country } as raw_user_meta_data so the
 * post-signup Auth-hook dispatcher (provision-retail-user/index.ts) can
 * route to provision_org_tenant after email verification.
 *
 * Deliberately short — decision Q10-D drops the 5-step legacy wizard in
 * favour of "one form + email verify, everything else as post-signup
 * Setup cards". KYC + billing fields appear in-app when the user upgrades
 * or hits a gated feature (tiered KYC, decision Q9-C).
 *
 * Turnstile is intentionally NOT wired in this drop. Freemium-first
 * means low value-to-attack; Supabase Auth's built-in rate limits cover
 * the basic abuse cases. Add Turnstile if we see bot signups in the wild
 * — the captchaToken plumbing already exists in
 * src/pages/SelfServiceOnboarding.tsx and can be lifted in.
 *
 * See docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 */
import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { SosLogo } from "@/components/branding";

import { SIGNUP_DOMAINS, isSignupDomain, type SignupDomain } from "./types";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

const COUNTRIES: ReadonlyArray<{ code: string; label: string }> = [
  { code: "IN", label: "India" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SG", label: "Singapore" },
  { code: "OTHER", label: "Other" },
];

const schema = z.object({
  email:    z.string().email("Enter a valid work email"),
  password: z.string().min(8, "At least 8 characters"),
  orgName:  z.string().min(2, "Enter the organization name"),
  country:  z.string().min(2),
});

type FormErrors = Partial<Record<keyof z.infer<typeof schema>, string>>;

export default function SignupForm() {
  const { domain: domainParam } = useParams<{ domain: string }>();
  const { signUp } = useAuth();

  // All hooks first — never gate them behind an early return.
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [orgName,  setOrgName]  = useState("");
  const [country,  setCountry]  = useState("IN");
  const [errors,   setErrors]   = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  const isValidDomain = isSignupDomain(domainParam);
  const domain: SignupDomain = isValidDomain ? domainParam : "logistics";
  const brochure = SIGNUP_DOMAINS[domain];

  const orgNamePlaceholder = useMemo(
    () => `Your ${brochure.orgNoun} name`,
    [brochure.orgNoun],
  );

  // Guard the URL param after hooks are wired. Unknown domain → kick
  // back to the picker.
  if (!isValidDomain) {
    return <Navigate to="/signup" replace />;
  }

  const validate = (): boolean => {
    const parsed = schema.safeParse({ email, password, orgName, country });
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const next: FormErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof FormErrors;
      if (!next[key]) next[key] = issue.message;
    }
    setErrors(next);
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const { error } = await signUp(email.trim(), password, {
        domain_code: domain,
        org_name:    orgName.trim(),
        country,
      });

      if (error) {
        const msg = error.message ?? "Signup failed";
        if (/already.*registered|exists/i.test(msg)) {
          toast.error("This email already has an account. Sign in instead?");
        } else {
          toast.error(msg);
        }
        return;
      }

      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground mb-6" aria-label="Step 3 of 3">
            Step 3 of 3 · Verify your email
          </p>
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We sent a verification link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Click it
            to finish setting up your {brochure.name} account — we'll create
            your workspace and drop you on the dashboard.
          </p>
          <p className="mt-6 text-xs text-muted-foreground">
            Didn't get it? Check spam, or{" "}
            <Link to="/auth" className="font-medium text-foreground hover:underline">
              try signing in
            </Link>
            {" "}— if your email already has an account we'll redirect you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-10 md:py-14">
        <Link
          to="/signup"
          className="
            inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground
            focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded
          "
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>

        <header className="mt-6 mb-6 space-y-2">
          <SosLogo size={40} />
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground pt-2" aria-label="Step 2 of 3">
            Step 2 of 3 · Register {brochure.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your {brochure.name} account
          </h1>
          <p className="text-sm text-muted-foreground">
            You'll start on the Free plan — no card needed. Add teammates,
            connect data, and upgrade later from Settings.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <OAuthButtons
            disabled={submitting}
            signupContext={{ domain_code: domain, country }}
          />
          <div className="space-y-1.5">
            <Label htmlFor="signup-email">Work email</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "signup-email-error" : undefined}
              disabled={submitting}
            />
            {errors.email && <p id="signup-email-error" role="alert" className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "signup-password-error" : undefined}
              disabled={submitting}
            />
            {errors.password && <p id="signup-password-error" role="alert" className="text-xs text-destructive">{errors.password}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="signup-org">Organization name</Label>
            <Input
              id="signup-org"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={orgNamePlaceholder}
              aria-invalid={Boolean(errors.orgName)}
              aria-describedby={errors.orgName ? "signup-org-error" : undefined}
              disabled={submitting}
            />
            {errors.orgName && <p id="signup-org-error" role="alert" className="text-xs text-destructive">{errors.orgName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="signup-country">Country</Label>
            <Select value={country} onValueChange={setCountry} disabled={submitting}>
              <SelectTrigger id="signup-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(({ code, label }) => (
                  <SelectItem key={code} value={code}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating your account…
              </span>
            ) : (
              "Create account"
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline">
              terms
            </a>
            {" "}and{" "}
            <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline">
              privacy policy
            </a>
            .
          </p>
        </form>

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </footer>
      </div>
    </div>
  );
}
