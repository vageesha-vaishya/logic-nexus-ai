// /// <reference types="https://esm.sh/@supabase/functions@1.3.1/types.ts" />
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
    const requireEnv = (name: string) => {
      const v = Deno.env.get(name);
      if (!v) throw new Error(`Missing environment variable: ${name}`);
      return v;
    };
    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { code, provider, userId, emailAddress, displayName, isPrimary, accountIdHint } = payload || {};

    if (!code || !provider || !userId) {
      throw new Error("Missing required fields: code, provider, userId");
    }

    if (!["gmail", "office365"].includes(String(provider))) {
      throw new Error("Unsupported provider");
    }

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
           "https://graph.microsoft.com/Mail.Read",
           "https://graph.microsoft.com/Mail.Send",
           "https://graph.microsoft.com/Mail.ReadWrite",
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

    // If Gmail, fetch user profile to ensure we have email/name
    let resolvedEmail = emailAddress;
    let resolvedName = displayName;
    if (provider === "gmail") {
      try {
        const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          resolvedEmail = resolvedEmail || profile.email || "";
          resolvedName = resolvedName || profile.name || "";
        }
      } catch (e) {
        console.log("Gmail userinfo fetch failed", e);
      }
    }

    // Get user's tenant and franchise IDs
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("tenant_id, franchise_id")
      .eq("user_id", userId)
      .single();

    // Upsert existing account for this user/provider/email
    let account;
    let accountError;

    // Prefer updating the hinted account id (the one user clicked Re-authorize on)
    let existingId: string | null = null;
    if (accountIdHint) {
      const { data: existingById } = await supabase
        .from("email_accounts")
        .select("id, user_id, email_address")
        .eq("id", accountIdHint)
        .eq("user_id", userId)
        .maybeSingle();
      existingId = existingById?.id ?? null;
      // If no email was provided by provider, reuse existing row email
      if (existingById?.email_address && !(resolvedEmail || emailAddress)) {
        resolvedEmail = existingById.email_address;
      }
    }

    // If no hinted row, try matching by exact email
    if (!existingId && (resolvedEmail || emailAddress)) {
      const { data: existingByEmail } = await supabase
        .from("email_accounts")
        .select("id, email_address")
        .eq("user_id", userId)
        .eq("provider", provider)
        .eq("email_address", (resolvedEmail || emailAddress) as string)
        .maybeSingle();
      existingId = existingByEmail?.id ?? null;
    }

    // Fallback: pick most recent account for this provider
    if (!existingId) {
      const { data: existingAny } = await supabase
        .from("email_accounts")
        .select("id, email_address")
        .eq("user_id", userId)
        .eq("provider", provider)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      existingId = existingAny?.id ?? null;
      if (existingAny?.email_address && !(resolvedEmail || emailAddress)) {
        resolvedEmail = existingAny.email_address;
      }
    }

    const emailAccountPayload = {
      user_id: userId,
      tenant_id: userRole?.tenant_id,
      franchise_id: userRole?.franchise_id,
      provider,
      email_address: (resolvedEmail || emailAddress || "") as string,
      display_name: resolvedName || displayName || null,
      is_primary: isPrimary,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      is_active: true,
    };

    if (existingId) {
      ({ data: account, error: accountError } = await supabase
        .from("email_accounts")
        .update(emailAccountPayload)
        .eq("id", existingId)
        .select()
        .single());
    } else {
      ({ data: account, error: accountError } = await supabase
        .from("email_accounts")
        .insert(emailAccountPayload)
        .select()
        .single());
    }

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
