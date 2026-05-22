/**
 * AddDomainPrompt — remedy for ModuleAccessReason='domain_off'.
 *
 * The tenant doesn't have an active assignment for the module's domain.
 * Auto-redirects to /dashboard/settings/billing?add={domain} where the
 * billing page (BR-4) renders the catalog with the Add card highlighted.
 *
 * Renders a brief explanatory page in case the auto-redirect is blocked
 * or the user paused mid-redirect.
 */
import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";

import { RemedyShell } from "./RemedyShell";

interface Props {
  domainCode?: string;
}

export function AddDomainPrompt({ domainCode }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = domainCode ?? searchParams.get("add") ?? "";
  const target = code
    ? `/dashboard/settings/billing?add=${encodeURIComponent(code)}`
    : "/dashboard/settings/billing";

  useEffect(() => {
    // Small delay so the user sees the headline before navigating; UX
    // pause is intentional, not just a network hack.
    const id = window.setTimeout(() => navigate(target, { replace: true }), 800);
    return () => window.clearTimeout(id);
  }, [navigate, target]);

  return (
    <RemedyShell
      icon={ShoppingBag}
      iconTone="primary"
      title="Add this product to your workspace"
      body={
        code
          ? `${code} isn't enabled for this workspace yet. Taking you to Billing to add it…`
          : "This product isn't enabled for your workspace yet. Taking you to Billing…"
      }
      actions={
        <Button asChild>
          <Link to={target}>Go to Billing now</Link>
        </Button>
      }
    />
  );
}

export default AddDomainPrompt;
