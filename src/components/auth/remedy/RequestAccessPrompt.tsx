/**
 * RequestAccessPrompt — remedy for ModuleAccessReason='role'.
 *
 * The tenant owns the module's domain, but the user's role for this
 * tenant doesn't grant access. Pre-fills a mailto to the tenant_admin
 * if we can find one in the tenant's user_roles.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMemberships } from "@/hooks/useMemberships";

import { RemedyShell } from "./RemedyShell";

interface Props {
  moduleLabel?: string;
}

export function RequestAccessPrompt({ moduleLabel }: Props) {
  const { activeMembership } = useMemberships();
  const tenantId = activeMembership?.tenant_id;
  const tenantName = activeMembership?.tenant_name ?? "your workspace";

  // Find a tenant_admin we can address the access request to. RLS
  // grants every member read on user_roles for their tenant so this
  // works without elevated access.
  const adminQuery = useQuery({
    queryKey: ["tenant-admin-email", tenantId],
    enabled:  Boolean(tenantId),
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select("profiles:user_id ( email )")
        .eq("tenant_id", tenantId!)
        .eq("role", "tenant_admin")
        .limit(1)
        .maybeSingle();
      if (error) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data?.profiles?.email as string | undefined) ?? null;
    },
  });

  const adminEmail = adminQuery.data ?? null;
  const subject = encodeURIComponent(
    `Access request: ${moduleLabel ?? "feature"} on ${tenantName}`,
  );
  const body = encodeURIComponent(
    `Hi,\n\nI'd like access to ${moduleLabel ?? "this feature"} in ${tenantName} on SOS Services. Could you update my role or grant me the right permission?\n\nThanks.`,
  );

  return (
    <RemedyShell
      icon={Lock}
      iconTone="muted"
      title="You don't have access to this"
      body={
        moduleLabel
          ? `${moduleLabel} is part of ${tenantName} but your role doesn't grant access. Ask the workspace admin to invite you with the right role.`
          : `This page is part of ${tenantName} but your role doesn't grant access. Ask the workspace admin to invite you with the right role.`
      }
      actions={
        <>
          {adminEmail ? (
            <Button asChild>
              <a href={`mailto:${adminEmail}?subject=${subject}&body=${body}`}>
                <Mail className="mr-2 h-4 w-4" />
                Email {adminEmail}
              </a>
            </Button>
          ) : (
            <Button disabled>Couldn't find your workspace admin's email</Button>
          )}
          <Button asChild variant="ghost">
            <Link to="/dashboard">Back to my dashboard</Link>
          </Button>
        </>
      }
    />
  );
}

export default RequestAccessPrompt;
