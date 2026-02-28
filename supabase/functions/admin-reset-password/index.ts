import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

type ResetPayload = {
  target_user_id: string;
  new_password?: string;
  send_reset_link?: boolean;
  redirect_url?: string;
};

declare const Deno: any;

serveWithLogger(async (req, logger, supabase) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth validation
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify platform_admin role using injected supabase (Service Role)
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'platform_admin').maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: platform_admin required' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = user.id;

    // Redundant environment checks removed as serveWithLogger ensures client availability
    // But we might need env vars for other things? No, client is ready.

    const body: ResetPayload = await req.json();
    const targetUserId = body?.target_user_id;
    const newPassword = body?.new_password;
    const sendResetLink = !!body?.send_reset_link;
    const redirectUrl = body?.redirect_url || `${new URL(req.url).origin}/`;

    if (!targetUserId || (!newPassword && !sendResetLink)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine caller role and scope
    const { data: callerRoles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role, tenant_id, franchise_id")
      .eq("user_id", callerId);
    if (rolesErr) throw rolesErr;
    const isPlatformAdmin = (callerRoles || []).some((r: any) => r.role === "platform_admin");
    const tenantIds = Array.from(new Set((callerRoles || []).map((r: any) => r.tenant_id).filter(Boolean)));
    const franchiseIds = Array.from(new Set((callerRoles || []).map((r: any) => r.franchise_id).filter(Boolean)));
    const isTenantAdmin = (callerRoles || []).some((r: any) => r.role === "tenant_admin");
    const isFranchiseAdmin = (callerRoles || []).some((r: any) => r.role === "franchise_admin");

    // Get target user's roles
    const { data: targetRoles, error: targetErr } = await supabase
      .from("user_roles")
      .select("role, tenant_id, franchise_id")
      .eq("user_id", targetUserId);
    if (targetErr) throw targetErr;

    const targetTenantIds = Array.from(new Set((targetRoles || []).map((r: any) => r.tenant_id).filter(Boolean)));
    const targetFranchiseIds = Array.from(new Set((targetRoles || []).map((r: any) => r.franchise_id).filter(Boolean)));

    // Scope check
    let allowed = false;
    if (isPlatformAdmin) {
      allowed = true;
    } else if (isTenantAdmin) {
      allowed = tenantIds.some((tid) => targetTenantIds.includes(tid));
    } else if (isFranchiseAdmin) {
      allowed = franchiseIds.some((fid) => targetFranchiseIds.includes(fid));
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: "Access denied: out of scope" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute action
    if (newPassword) {
      const { error: updErr } = await supabase.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
      });
      if (updErr) throw updErr;
    }

    if (sendResetLink) {
      // Generate recovery link to email to user
      // Note: Supabase returns link; client may choose to send email via own system
      const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(targetUserId);
      if (userErr) throw userErr;
      const email = user?.email;
      if (email) {
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: redirectUrl },
        });
        if (linkErr) throw linkErr;
        // The generateLink response has properties.action_link
        const actionLink = linkData?.properties?.action_link;
        return new Response(JSON.stringify({ success: true, recovery_link: actionLink }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    logger.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}, "admin-reset-password");
