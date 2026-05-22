/**
 * UpgradePrompt — remedy for ModuleAccessReason='plan'.
 *
 * The user's role + domain pass, but the plan tier doesn't unlock this
 * module (or limits.modules[code] === false). Auto-redirects to
 * /dashboard/settings/billing?promote={module} where the billing page
 * (BR-4) renders the catalog with the matching upgrade card promoted.
 */
import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { RemedyShell } from "./RemedyShell";

interface Props {
  moduleCode?: string;
  moduleLabel?: string;
}

export function UpgradePrompt({ moduleCode, moduleLabel }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = moduleCode ?? searchParams.get("promote") ?? "";
  const target = code
    ? `/dashboard/settings/billing?promote=${encodeURIComponent(code)}`
    : "/dashboard/settings/billing";

  useEffect(() => {
    const id = window.setTimeout(() => navigate(target, { replace: true }), 800);
    return () => window.clearTimeout(id);
  }, [navigate, target]);

  const label = moduleLabel ?? "this feature";

  return (
    <RemedyShell
      icon={Sparkles}
      iconTone="primary"
      title={`Upgrade to unlock ${label}`}
      body="Your current plan doesn't include this feature. Taking you to Billing where you can upgrade your plan…"
      actions={
        <Button asChild>
          <Link to={target}>Go to Billing now</Link>
        </Button>
      }
    />
  );
}

export default UpgradePrompt;
