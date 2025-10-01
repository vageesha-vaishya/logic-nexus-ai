import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { code, provider, userId, emailAddress, displayName, isPrimary } = await req.json();

    // Fetch OAuth configuration
    const { data: config, error: configError } = await supabase
      .from("oauth_configurations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      throw new Error("OAuth configuration not found");
    }

    // Exchange authorization code for tokens
    let tokenUrl: string;
    let tokenBody: Record<string, string>;

    if (provider === "gmail") {
      tokenUrl = "https://oauth2.googleapis.com/token";
      tokenBody = {
        code,
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: config.redirect_uri,
        grant_type: "authorization_code",
      };
    } else if (provider === "office365") {
      const tenantId = config.tenant_id_provider || "common";
      tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      tokenBody = {
        code,
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: config.redirect_uri,
        grant_type: "authorization_code",
        scope: [
          "https://outlook.office.com/Mail.Read",
          "https://outlook.office.com/Mail.Send",
          "https://outlook.office.com/Mail.ReadWrite",
          "offline_access",
        ].join(" "),
      };
    } else {
      throw new Error("Unsupported provider");
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(tokenBody).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`);
    }

    const tokens = await tokenResponse.json();

    // Get user's tenant and franchise IDs
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("tenant_id, franchise_id")
      .eq("user_id", userId)
      .single();

    // Store email account with tokens
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .insert({
        user_id: userId,
        tenant_id: userRole?.tenant_id,
        franchise_id: userRole?.franchise_id,
        provider,
        email_address: emailAddress,
        display_name: displayName,
        is_primary: isPrimary,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (accountError) {
      throw accountError;
    }

    return new Response(
      JSON.stringify({ success: true, account }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error exchanging OAuth token:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
