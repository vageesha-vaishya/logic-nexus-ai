/**
 * SwitchTenantPrompt — remedy for ModuleAccessReason='wrong_tenant'.
 *
 * The user is signed-out or the link points at a tenant they're not a
 * member of. If they have other memberships, show the membership picker;
 * otherwise prompt to sign in with a different account.
 */
import { Building2, ArrowRight, LogIn } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMemberships } from "@/hooks/useMemberships";

import { RemedyShell } from "./RemedyShell";

export function SwitchTenantPrompt() {
  const { user, signOut } = useAuth();
  const { memberships, switchTo, isSwitching } = useMemberships();
  const navigate = useNavigate();

  // Signed-out — direct to /auth
  if (!user) {
    return (
      <RemedyShell
        icon={LogIn}
        iconTone="muted"
        title="Sign in to continue"
        body="This link requires you to be signed in. Sign in with the account that has access to this workspace."
        actions={
          <Button asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        }
      />
    );
  }

  // Signed-in but no other memberships — they can sign out + try again
  if (memberships.length <= 1) {
    return (
      <RemedyShell
        icon={Building2}
        iconTone="muted"
        title="This link belongs to another workspace"
        body="You're signed in, but this page is for a different workspace you're not a member of. Sign in with a different account to continue."
        actions={
          <>
            <Button
              onClick={async () => {
                await signOut();
                navigate("/auth", { replace: true });
              }}
            >
              Sign out and switch accounts
            </Button>
            <Button asChild variant="ghost">
              <Link to="/dashboard">Back to my dashboard</Link>
            </Button>
          </>
        }
      />
    );
  }

  // Multiple memberships — show the picker
  return (
    <RemedyShell
      icon={Building2}
      iconTone="muted"
      title="Switch workspace"
      body="This page is for a different workspace. Pick one of your memberships below."
      actions={
        <>
          <ul className="space-y-1.5 text-left">
            {memberships.map((m) => (
              <li key={m.id}>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  disabled={isSwitching}
                  onClick={() => void switchTo(m.id)}
                >
                  <span className="truncate">{m.display_label}</span>
                  <ArrowRight className="h-4 w-4 opacity-60" />
                </Button>
              </li>
            ))}
          </ul>
          <Button asChild variant="ghost">
            <Link to="/dashboard">Back to my dashboard</Link>
          </Button>
        </>
      }
    />
  );
}

export default SwitchTenantPrompt;
