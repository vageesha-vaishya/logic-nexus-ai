import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabase-functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { H2 } from '@/components/ui/Heading';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { SosLogo, accentForDomain } from '@/components/branding';
import { resolveActiveDomain } from '@/platform/domains/resolver';
import { getDomainManifest } from '@/platform/domains/registry';
import type { DomainManifest } from '@/platform/domains/types';
import { logger } from '@/lib/logger';
import { Capacitor } from '@capacitor/core';

function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

/**
 * Auth — sign-in page.
 *
 * Renders one of two chrome variants depending on the audience that
 * arrived (Q4 from docs/plans/2026-05-22-platform-brand-architecture-design.md):
 *
 *   - `?intent=retail` (or a `/sthira/...` referrer in location.state) →
 *     Sthira-branded chrome: cream background, copper accent, serif
 *     wordmark. Used when the visitor came from /welcome's "individual
 *     investor" tile or any Sthira-shell route.
 *   - Everything else → SOS-neutral chrome: SOS master logo + "Welcome
 *     back to SOS Services" + slate palette. The default for direct
 *     /auth visits and B2B sign-ins.
 *
 * The form logic, signIn handler, password-recovery flow, admin-seed
 * fallback — all identical between the two variants. Only the chrome
 * wrapper differs.
 */
export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Sthira signup toggle — flips the retail-variant form between sign-in
  // and "open an account". On success we render the email-verification
  // screen until the user comes back.
  const [signupMode, setSignupMode] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Audience detection: ?intent=retail OR navigated from a Sthira route
  // OR running in the Capacitor native shell (Sthira APK) — the latter
  // forces retail chrome even when the splash hasn't passed ?intent, so
  // CRM-branded signup can never leak into the mobile app. Native shells
  // also default `next` to the splash so post-login routes back through
  // onboarding evaluation instead of /dashboard (CRM home).
  const intent = searchParams.get('intent');
  const native = useMemo(isNativeShell, []);
  const nextFallback = native ? '/sthira/splash' : '/dashboard';
  const next   = searchParams.get('next') ?? (location.state as { from?: { pathname?: string } })?.from?.pathname ?? nextFallback;
  const isRetailVariant =
    native ||
    intent === 'retail' ||
    next.startsWith('/sthira/') ||
    next.startsWith('/dashboard/markets/retail');

  // MV-5 — domain hint for the SOS-neutral variant. Priority order:
  //   (1) ?intent=retail wins → Sthira variant (handled above)
  //   (2) next path matches a domain's pathPrefixes (and isn't retail)
  //   (3) document.referrer is a /signup/<domain> page
  //   (4) no hint — generic SOS-neutral
  // Retail matches stay on the Sthira chrome path; only non-retail
  // matches surface as a tint on SosChrome.
  const domainHint = useMemo<DomainManifest | null>(() => {
    if (isRetailVariant) return null;
    const nextMatch = resolveActiveDomain(next);
    if (nextMatch && nextMatch.code !== 'MARKETS') return nextMatch;
    if (typeof document !== 'undefined' && document.referrer) {
      try {
        const referrerPath = new URL(document.referrer).pathname;
        const refMatch = resolveActiveDomain(referrerPath);
        if (refMatch && refMatch.code !== 'MARKETS') return refMatch;
        // /signup/[domain] referrer — derive from the URL slug
        const signupMatch = referrerPath.match(/^\/signup\/(logistics|markets|amro)$/);
        if (signupMatch && signupMatch[1] !== 'markets') {
          return getDomainManifest(signupMatch[1]);
        }
      } catch {
        /* document.referrer may be a cross-origin URL; ignore */
      }
    }
    return null;
  }, [isRetailVariant, next]);

  useEffect(() => {
    if (user) {
      navigate(next, { replace: true });
    }
  }, [user, navigate, next]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hashParams  = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const hashType  = hashParams.get('type');
    const queryType = queryParams.get('type');
    if (hashType === 'recovery' || queryType === 'recovery') setRecoveryMode(true);

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const validateStrongPassword = (value: string) => {
    if (value.length < 12) return false;
    if (!/[a-z]/.test(value)) return false;
    if (!/[A-Z]/.test(value)) return false;
    if (!/[0-9]/.test(value)) return false;
    if (!/[^A-Za-z0-9]/.test(value)) return false;
    return true;
  };

  const handleRecoverySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateStrongPassword(recoveryPassword)) {
      toast.error('Password must be 12+ chars with upper, lower, number, and symbol.');
      return;
    }
    if (recoveryPassword !== recoveryConfirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
      if (error) throw error;
      toast.success('Password reset successful. Please sign in.');
      setRecoveryMode(false);
      setRecoveryPassword('');
      setRecoveryConfirmPassword('');
      if (typeof window !== 'undefined') {
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
      }
      await supabase.auth.signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      loginSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }
    setLoading(true);
    try {
      // domain_code routes the post-signup provision-retail-user hook to
      // markets.provision_new_retail_user, which seeds the paper portfolio +
      // NIFTY ETF + retail_profile. No org_name / country needed for retail.
      const { error } = await signUp(email.trim(), password, { domain_code: 'sthira-retail' });
      if (error) {
        const msg = error.message ?? 'Signup failed';
        if (/already.*registered|exists/i.test(msg)) {
          toast.error('This email already has an account. Sign in instead?');
          setSignupMode(false);
        } else if (/failed to fetch/i.test(msg)) {
          toast.error('Connection error — check your network and try again.');
        } else {
          toast.error(msg);
        }
        return;
      }
      setSignupSuccess(true);
    } catch (err) {
      logger.error('Signup error:', err);
      toast.error(err instanceof Error ? err.message : 'Signup failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      loginSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }
    setLoading(true);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please check your connection.')), 15000)
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await Promise.race([signIn(email, password), timeoutPromise]) as { error: any };
      const { error } = result;

      if (error) {
        logger.error('Sign in error:', error);
        const isAdminEmail = email.trim().toLowerCase() === 'bahuguna.vimal@gmail.com';
        if (error.message.includes('Invalid login credentials') && isAdminEmail) {
          try {
            logger.debug('Attempting to seed admin account...');
            const seedResult = await Promise.race([
              invokeFunction('seed-platform-admin', { body: { email, password } }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Seeding timed out')), 10000))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ]) as { data: any, error: any };
            const { data, error: seedError } = seedResult;
            if (seedError) {
              logger.error('Seeding error:', seedError);
              toast.error('Admin account not found. Use Setup to create it.');
            } else if (data?.success) {
              toast.success('Admin created. Signing you in...');
              const { error: retryError } = await signIn(email, password);
              if (!retryError) {
                navigate(next, { replace: true });
                setLoading(false);
                return;
              }
            }
          } catch (err) {
            logger.error('Seeding failed:', err);
            toast.error('Setup required. Please run Platform Setup.');
          }
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please verify your email address');
        } else if (error.message.includes('Failed to fetch')) {
          toast.error('Connection Error', {
            description: 'Could not connect to the server. Please check your internet connection or VPN.'
          });
        } else {
          toast.error(error.message);
        }
        setLoading(false);
        return;
      }
      toast.success('Welcome back!');
      navigate(next, { replace: true });
    } catch (err) {
      logger.error('Login process error:', err);
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const ChromeComponent = isRetailVariant ? SthiraChrome : SosChrome;
  const isSignupView = isRetailVariant && signupMode && !recoveryMode;
  const isSignupDone = isRetailVariant && signupSuccess && !recoveryMode;

  // Build the form once and slot it into whichever chrome the audience earned.
  const formBody = isSignupDone ? (
    <div className="space-y-4 text-center">
      <p className="text-sm text-[hsl(var(--sthira-ink))]">
        We sent a verification link to{' '}
        <span className="font-medium">{email}</span>. Tap it on this device
        to finish setup — we&apos;ll seed your paper portfolio and drop you
        into the onboarding wizard.
      </p>
      <p className="text-xs text-[hsl(var(--sthira-fog))]">
        Didn&apos;t get it? Check spam, or come back and sign in once your
        email is verified.
      </p>
      <Button
        type="button"
        variant="outline"
        className="w-full border-[hsl(var(--sthira-copper))] text-[hsl(var(--sthira-copper))] hover:bg-[hsl(var(--sthira-copper)/0.08)]"
        onClick={() => {
          setSignupSuccess(false);
          setSignupMode(false);
          setPassword('');
        }}
      >
        Back to sign in
      </Button>
    </div>
  ) : recoveryMode ? (
    <form onSubmit={handleRecoverySubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="recovery-password">New password</Label>
        <Input
          id="recovery-password"
          type="password"
          value={recoveryPassword}
          onChange={(e) => setRecoveryPassword(e.target.value)}
          placeholder="12+ chars, upper / lower / number / symbol"
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recovery-confirm">Confirm password</Label>
        <Input
          id="recovery-confirm"
          type="password"
          value={recoveryConfirmPassword}
          onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : 'Set new password'}
      </Button>
    </form>
  ) : (
    <form onSubmit={isSignupView ? handleSignupSubmit : handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          data-testid="email-input"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          data-testid="password-input"
          type="password"
          autoComplete={isSignupView ? 'new-password' : 'current-password'}
          placeholder={isSignupView ? 'At least 8 characters' : '••••••••'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <Button
        type="submit"
        className={cn(
          "w-full",
          isRetailVariant &&
            "bg-[hsl(var(--sthira-copper))] text-white hover:bg-[hsl(var(--sthira-copper)/0.9)] focus-visible:ring-[hsl(var(--sthira-copper))]",
        )}
        disabled={loading}
        data-testid={isSignupView ? 'signup-btn' : 'login-btn'}
      >
        {loading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isSignupView ? 'Creating account…' : 'Signing in…'}</>
        ) : (
          isSignupView ? 'Create account' : 'Sign in'
        )}
      </Button>
      {!isRetailVariant && (
        <>
          <div className="pt-2 text-center text-sm text-muted-foreground">
            First time setup?{' '}
            <Link to="/setup-admin" className="text-primary underline">Create Platform Admin</Link>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            New here?{' '}
            <Link to="/signup" className="text-primary underline">Register your organization</Link>
            {' '}or{' '}
            <Link to="/welcome" className="text-primary underline">explore options</Link>
          </div>
        </>
      )}
      {isRetailVariant && !isSignupView && (
        <div className="pt-2 text-center text-sm text-sthira-fog">
          New to Sthira?{' '}
          <button
            type="button"
            onClick={() => setSignupMode(true)}
            className="text-sthira-copper underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sthira-copper rounded"
          >
            Open an account
          </button>
        </div>
      )}
      {isRetailVariant && isSignupView && (
        <div className="pt-2 text-center text-sm text-sthira-fog">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => setSignupMode(false)}
            className="text-sthira-copper underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sthira-copper rounded"
          >
            Sign in
          </button>
        </div>
      )}
      {isRetailVariant && isSignupView && (
        <p className="pt-1 text-center text-[11px] text-sthira-fog">
          By continuing you agree to our{' '}
          <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline">terms</a>
          {' '}and{' '}
          <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline">privacy policy</a>.
        </p>
      )}
    </form>
  );

  // Eyebrow + title morphs to "Welcome back to SOS Logistics" / etc. when
  // a domain hint resolved. Sthira variant stays as it was.
  const title = isRetailVariant
    ? 'Sthira'
    : domainHint
      ? `SOS ${domainHint.sidebar?.label ?? domainHint.name}`
      : 'SOS Services';

  const subtitle = recoveryMode
    ? 'Set a new password for your account'
    : isSignupDone
      ? 'Check your email to finish setup'
      : isSignupView
        ? 'Open an account to start investing'
        : 'Sign in to continue';

  return (
    <ChromeComponent
      title={title}
      subtitle={subtitle}
      domainHint={isRetailVariant ? null : domainHint}
    >
      {formBody}
    </ChromeComponent>
  );
}

// ─── Chrome variants ───────────────────────────────────────────────────────

interface ChromeProps {
  title:        string;
  subtitle:     string;
  children:     ReactNode;
  /** MV-5 — when set, SosChrome paints a 4px accent strip + tagline. */
  domainHint?:  DomainManifest | null;
}

function SosChrome({ title, subtitle, children, domainHint }: ChromeProps) {
  const accentHex = domainHint ? accentForDomain(domainHint.code.toLowerCase()) : null;
  const productName = domainHint?.sidebar?.label ?? domainHint?.name;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="relative w-full max-w-md overflow-hidden">
        {/* MV-5 — domain accent strip at the top of the login card. */}
        {accentHex && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: accentHex }}
          />
        )}
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <SosLogo size={64} productName={productName} />
          </div>
          <H2>{title}</H2>
          {productName && (
            <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
              Welcome back to SOS {productName}
            </p>
          )}
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

function SthiraChrome({ title, subtitle, children }: ChromeProps) {
  return (
    <div
      className={cn(
        'min-h-screen flex items-center justify-center p-4',
        'bg-[hsl(var(--sthira-cream))] text-[hsl(var(--sthira-ink))]',
      )}
    >
      <Card className="w-full max-w-md border-[hsl(var(--sthira-copper)/0.2)] bg-white/70 backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[hsl(var(--sthira-fog))]">
            Steady wealth
          </p>
          <h1
            className="text-4xl font-semibold tracking-tight text-[hsl(var(--sthira-copper))]"
            style={{ fontFamily: 'var(--font-sthira-serif, ui-serif, Georgia, serif)' }}
          >
            {title}
          </h1>
          <CardDescription className="text-[hsl(var(--sthira-fog))]">{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
