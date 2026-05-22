/**
 * /invite/[token] — magic-link landing page.
 *
 * Calls the accept-invite edge function, which validates the token,
 * inserts a user_roles row scoped to the inviting tenant, and points
 * user_active_membership at it. The same React page handles all four
 * branches:
 *
 *   - signed-in same email           → auto-accept + hard reload to /dashboard
 *   - signed-in different email      → friendly error "this invite is for a
 *                                      different email", offers Sign out CTA
 *   - signed-out                     → "Sign in to accept" CTA → /auth?next=/invite/[token];
 *                                      after auth lands the page re-fires
 *   - expired / revoked / not found  → friendly error, "ask your admin to resend"
 *
 * The edge function does the heavy lifting (token + expiry + email-match
 * + idempotency). This page just renders the four states.
 *
 * See docs/plans/2026-05-22-unified-platform-onboarding-design.md.
 */
import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, MailWarning, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AcceptState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "auth_required" }
  | { kind: "error"; code: string; message: string };

interface AcceptResponse {
  ok:      boolean;
  code?:   string;
  message?: string;
  redirect?: string;
}

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<AcceptState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authLoading || !token) return;

      if (!user) {
        setState({ kind: "auth_required" });
        return;
      }

      setState({ kind: "loading" });

      try {
        const { data, error } = await supabase.functions.invoke<AcceptResponse>(
          "accept-invite",
          { body: { token } },
        );

        if (cancelled) return;

        if (error || !data?.ok) {
          // The edge function returns a JSON body even on non-2xx; supabase-js
          // surfaces it via context.error.message → we'd lose the friendly
          // body. Try to coax the body from the function's response context.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ctxBody = (error as any)?.context?.json ?? data;
          const code    = (ctxBody && typeof ctxBody === "object" && "code" in ctxBody) ? String(ctxBody.code) : "accept_failed";
          const message = (ctxBody && typeof ctxBody === "object" && "message" in ctxBody)
            ? String(ctxBody.message)
            : (error?.message ?? "Could not accept the invite.");
          setState({ kind: "error", code, message });
          return;
        }

        toast.success("You're in — welcome to the team.");
        setState({ kind: "ok" });
        // Hard reload so every domain-keyed query refetches under the new
        // active membership (same approach as the context switcher).
        window.location.assign(data.redirect ?? "/dashboard");
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not accept the invite.";
        setState({ kind: "error", code: "accept_failed", message });
      }
    })();
    return () => { cancelled = true; };
  }, [token, user, authLoading]);

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-16 text-center">{children}</div>
    </div>
  );

  if (!token) {
    return (
      <Shell>
        <XCircle className="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Invitation link is missing the token</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Paste the full link from your email — it should look like
          {" "}<code className="text-foreground">/invite/&lt;token&gt;</code>.
        </p>
        <Button asChild variant="ghost" className="mt-6">
          <Link to="/welcome">Back to home</Link>
        </Button>
      </Shell>
    );
  }

  if (authLoading || state.kind === "loading" || state.kind === "idle") {
    return (
      <Shell>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-foreground">Checking your invite…</p>
      </Shell>
    );
  }

  if (state.kind === "auth_required") {
    const next = encodeURIComponent(`/invite/${token}`);
    return (
      <Shell>
        <MailWarning className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">You've been invited</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in to accept this invite. If you don't have an account yet,
          you can create one — we'll add you to your team right after.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild>
            <Link to={`/auth?next=${next}`}>Sign in to accept</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to={`/auth?next=${next}&mode=signup`}>Create an account first</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  if (state.kind === "ok") {
    return (
      <Shell>
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-foreground">Taking you to the dashboard…</p>
      </Shell>
    );
  }

  // state.kind === "error"
  return (
    <Shell>
      <XCircle className="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {state.code === "email_mismatch" ? "Wrong account" : "Couldn't accept this invite"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">{state.message}</p>
      <div className="mt-6 flex flex-col gap-2">
        {state.code === "email_mismatch" && (
          <Button
            onClick={async () => {
              await signOut();
              navigate(`/auth?next=${encodeURIComponent(`/invite/${token}`)}`, { replace: true });
            }}
          >
            Sign out and switch accounts
          </Button>
        )}
        <Button asChild variant={state.code === "email_mismatch" ? "ghost" : "default"}>
          <Link to="/dashboard">Go to my dashboard</Link>
        </Button>
      </div>
    </Shell>
  );
}
