// /// <reference types="https://esm.sh/@supabase/functions@1.3.1/types.ts" />
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { serveWithLogger } from "../_shared/logger.ts";

declare const Deno: any;

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: require authenticated user
  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
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
    const { data: config, error: configError } = await supabaseAdmin
      .from("oauth_configurations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("is_active", true)
      .maybeSingle();

    // Determine credentials (DB vs Env Var Fallback)
    let clientId = config?.client_id;
    let clientSecret = config?.client_secret;
    let redirectUri = config?.redirect_uri;
    let tenantIdProvider = config?.tenant_id_provider;

    // Fallback to Env Vars if not in DB
    if (!clientId || !clientSecret) {
      if (provider === "gmail") {
        clientId = Deno.env.get("GOOGLE_CLIENT_ID");
        clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
        // Default redirect URI for system config if not provided
        if (!redirectUri) redirectUri = `${req.headers.get("origin") || "http://localhost:8081"}/oauth/callback`;
      } else if (provider === "office365") {
        clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
        clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
        if (!redirectUri) redirectUri = `${req.headers.get("origin") || "http://localhost:8081"}/oauth/callback`;
        // Default tenant
        if (!tenantIdProvider) tenantIdProvider = "common";
      }
    }

    if (!clientId || !clientSecret) {
      logger.error(`Missing OAuth credentials for ${provider}. DB Config: ${!!config}, Env Vars Present: ${!!Deno.env.get("GOOGLE_CLIENT_ID")}`);
      throw new Error(`OAuth credentials not configured for ${provider}. System admin must set environment variables or user must have custom config.`);
    }

    // Ensure redirectUri is defined
    if (!redirectUri) {
         redirectUri = `${req.headers.get("origin") || "http://localhost:8081"}/oauth/callback`;
    }

    // Exchange authorization code for tokens
    let tokenUrl: string;
    let tokenBody: Record<string, string>;

    if (provider === "gmail") {
      tokenUrl = "https://oauth2.googleapis.com/token";
      tokenBody = {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      };
    } else if (provider === "office365") {
      // Detect Microsoft personal accounts (MSA) and use "consumers" tenant
      const lowerEmail = String(emailAddress || "").toLowerCase();
      const isMSA = /@(hotmail|outlook|live|msn)\.com$/.test(lowerEmail);
      const tenantId = isMSA ? "consumers" : (tenantIdProvider || "common");
      
      logger.info(`Exchanging token for ${emailAddress} using tenant: ${tenantId}`);
      
      tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      tokenBody = {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: [
          "https://graph.microsoft.com/Mail.Read",
          "https://graph.microsoft.com/Mail.Send",
          "https://graph.microsoft.com/Mail.ReadWrite",
          "offline_access",
          "openid",
          "profile",
          "email",
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
        logger.error("Gmail userinfo fetch failed", { error: e });
      }
    }

    // Get user's tenant and franchise IDs
    const { data: userRole } = await supabaseAdmin
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
      const { data: existingById } = await supabaseAdmin
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
      const { data: existingByEmail } = await supabaseAdmin
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
      const { data: existingAny } = await supabaseAdmin
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
      updated_at: new Date().toISOString(), // Ensure updated_at is set
    };

    if (existingId) {
      ({ data: account, error: accountError } = await supabaseAdmin
        .from("email_accounts")
        .update(emailAccountPayload)
        .eq("id", existingId)
        .select()
        .single());
    } else {
      ({ data: account, error: accountError } = await supabaseAdmin
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
    logger.error("Error exchanging OAuth token:", { error });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}, "exchange-oauth-token");
