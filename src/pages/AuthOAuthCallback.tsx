/**
 * AuthOAuthCallback — sign-in OAuth callback page at /auth/callback.
 *
 * NOT to be confused with /oauth/callback (src/pages/OAuthCallback.tsx)
 * which is the email-account-connection flow (Gmail/Office 365 inbox
 * import for the email-management module). That path has its own
 * exchange-oauth-token edge function and writes to user_email_accounts.
 *
 * This page is reached AFTER Supabase Auth completes the OAuth handshake
 * with Google or Microsoft and 302's back to us with the session in the
 * URL hash. Supabase's detectSessionInUrl (default true) picks the hash
 * up and calls setSession() automatically; this page just waits for
 * the session to be established and routes to "/" where RootRedirect
 * sends the user to the right shell.
 *
 * Errors (provider rejected, user cancelled at provider, network) land
 * on this page with `?error=...&error_description=...` query params per
 * Supabase Auth conventions. We surface the description and offer a
 * back-to-sign-in button.
 *
 * Design: docs/plans/2026-05-27-google-microsoft-auth-design.md
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import {
  readPendingSignupContext,
  clearPendingSignupContext,
} from "@/lib/auth/oauthSignIn";

function deriveOrgNameFromEmail(email: string | undefined | null): string {
  if (!email) return "My organization";
  const at = email.indexOf("@");
  if (at < 0 || at === email.length - 1) return "My organization";
  const host = email.slice(at + 1);
  // Drop the TLD ("acme.co.in" → "acme") and capitalize. Best-effort —
  // user will edit in Settings → Organization if the guess is wrong.
  const sld = host.split(".")[0] || "";
  if (!sld) return "My organization";
  return sld.charAt(0).toUpperCase() + sld.slice(1);
}

async function dispatchDomainProvisionIfNeeded(
  userId: string,
  email: string | undefined | null,
): Promise<void> {
  const ctx = readPendingSignupContext();
  if (!ctx) return;
  // Clear immediately so a refresh-loop can't fire the call twice.
  clearPendingSignupContext();

  if (ctx.domain_code !== "logistics" && ctx.domain_code !== "markets") {
    // Retail or unknown — the Auth-hook already ran retail provisioning.
    return;
  }

  const orgName = deriveOrgNameFromEmail(email);
  try {
    const { error } = await supabase.functions.invoke("provision-retail-user", {
      body: {
        user_id: userId,
        meta: {
          domain_code: ctx.domain_code,
          org_name:    orgName,
          country:     ctx.country ?? "IN",
        },
      },
    });
    if (error) {
      logger.warn("[auth-oauth] domain provisioning failed", {
        userId, domain_code: ctx.domain_code, error: error.message,
      });
    }
  } catch (e) {
    logger.warn("[auth-oauth] domain provisioning threw", {
      userId, domain_code: ctx.domain_code,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

type State = "processing" | "error";

export default function AuthOAuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<State>("processing");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    // Provider returned an OAuth error (user cancelled, consent denied,
    // invalid scope, etc.) — Supabase forwards these as query params.
    const err = params.get("error");
    const errDesc = params.get("error_description");
    if (err) {
      logger.warn("[auth-oauth] provider error", { err, errDesc });
      setErrorDetail(errDesc ?? err);
      setState("error");
      return;
    }

    // Happy path: supabase-js parses the URL hash and sets the session
    // automatically. We poll getSession() briefly to confirm before
    // routing — usually it's set within one tick, but on slow networks
    // it can take longer.
    let cancelled = false;
    let attempts = 0;

    const tryOnce = async () => {
      attempts += 1;
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session) {
        // If this OAuth roundtrip originated from /signup/:domain, the
        // sessionStorage breadcrumb tells us which B2B tenant to
        // provision. Fire-and-await before routing — the call is fast
        // (single RPC) and idempotent. RootRedirect uses memberships
        // to pick the right shell, so we want them written before
        // it runs. Failures degrade gracefully: the user still has the
        // default retail membership from the Auth hook.
        await dispatchDomainProvisionIfNeeded(
          session.user.id,
          session.user.email,
        );
        // RootRedirect handles the rest (Sthira vs CRM, multi-membership).
        navigate("/", { replace: true });
        return;
      }
      if (attempts >= 15) {
        // ~6 seconds of polling. Surface a sane error and bounce back to
        // /auth so the user can retry.
        setErrorDetail(
          "Sign-in didn't complete. Please try again or use email instead.",
        );
        setState("error");
        return;
      }
      setTimeout(tryOnce, 400);
    };
    tryOnce();
    return () => { cancelled = true; };
  }, [navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center space-y-4 max-w-sm">
        {state === "processing" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
            <h1 className="text-xl font-semibold">Finishing sign-in…</h1>
            <p className="text-sm text-muted-foreground">
              You'll be redirected in a moment.
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <div className="w-10 h-10 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="text-destructive font-bold">!</span>
            </div>
            <h1 className="text-xl font-semibold">Sign-in failed</h1>
            <p className="text-sm text-muted-foreground">
              {errorDetail ?? "An unknown error occurred."}
            </p>
            <Link
              to="/auth"
              className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
