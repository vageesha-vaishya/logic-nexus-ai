import { supabase } from "@/integrations/supabase/client";

interface OAuthConfig {
  client_id: string;
  client_secret: string;
  tenant_id_provider?: string;
  redirect_uri: string;
}

export async function initiateGoogleOAuth(userId: string) {
  try {
    // 1. Try to fetch User-specific OAuth configuration from DB
    const { data: config } = await supabase
      .from("oauth_configurations" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .eq("is_active", true)
      .maybeSingle(); // Use maybeSingle to avoid error if not found

    // 2. Determine Client ID and Redirect URI
    let clientId = config ? config.client_id : undefined;
    let redirectUri = config ? config.redirect_uri : undefined;

    // 3. Fallback to System Environment Variables if DB config is missing
    if (!clientId) {
      clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      // Default redirect URI for system config
      redirectUri = `${window.location.origin}/oauth/callback`;
    }

    if (!clientId) {
      throw new Error("Gmail OAuth not configured. System administrator must set VITE_GOOGLE_CLIENT_ID or User must provide custom configuration.");
    }
    
    // Ensure redirectUri is defined (should be from DB or constructed above)
    if (!redirectUri) {
       redirectUri = `${window.location.origin}/oauth/callback`;
    }

    // Generate state parameter for security
    const state = crypto.randomUUID();
    sessionStorage.setItem("oauth_state", state);
    sessionStorage.setItem("oauth_provider", "gmail");

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ].join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
    // Redirect to Google OAuth
    window.location.href = authUrl;
  } catch (error: any) {
    throw new Error(error.message || "Failed to initiate Google OAuth");
  }
}

export async function initiateMicrosoftOAuth(userId: string) {
  try {
    // 1. Try to fetch User-specific OAuth configuration
    const { data: config } = await supabase
      .from("oauth_configurations" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "office365")
      .eq("is_active", true)
      .maybeSingle();

    // 2. Determine Client ID and Redirect URI
    let clientId = config ? config.client_id : undefined;
    let redirectUri = config ? config.redirect_uri : undefined;
    let tenantIdProvider = config ? config.tenant_id_provider : undefined;

    // 3. Fallback to System Environment Variables
    if (!clientId) {
      clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
      redirectUri = `${window.location.origin}/oauth/callback`;
      // Default to common for system app unless specified
      tenantIdProvider = "common";
    }

    if (!clientId) {
      throw new Error("Office 365 OAuth not configured. System administrator must set VITE_MICROSOFT_CLIENT_ID or User must provide custom configuration.");
    }

    if (!redirectUri) {
        redirectUri = `${window.location.origin}/oauth/callback`;
    }

    // Generate state parameter for security
    const state = crypto.randomUUID();
    sessionStorage.setItem("oauth_state", state);
    sessionStorage.setItem("oauth_provider", "office365");

  // Determine tenant based on email hint to avoid tenant mismatch on token exchange
  const hintEmail = sessionStorage.getItem("oauth_hint_email") || "";
  const lowerEmail = hintEmail.toLowerCase();
  const isMSA = /@(hotmail|outlook|live|msn)\.com$/.test(lowerEmail);
  const tenantId = isMSA ? "consumers" : (tenantIdProvider || "common");

  // Build Microsoft OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://graph.microsoft.com/Mail.Read",
      "https://graph.microsoft.com/Mail.Send",
      "https://graph.microsoft.com/Mail.ReadWrite",
      "offline_access",
      "openid",
      "profile",
      "email",
    ].join(" "),
    prompt: "consent",
    state,
  });

  if (hintEmail) {
    params.set("login_hint", hintEmail);
  }

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  
  // Redirect to Microsoft OAuth
  window.location.href = authUrl;
  } catch (error: any) {
    throw new Error(error.message || "Failed to initiate Microsoft OAuth");
  }
}

export async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) {
    throw new Error(`OAuth error: ${error}`);
  }

  // Verify state parameter
  const savedState = sessionStorage.getItem("oauth_state");
  const provider = sessionStorage.getItem("oauth_provider");

  if (!code || !state || state !== savedState) {
    throw new Error("Invalid OAuth callback");
  }

  // Clean up session storage
  sessionStorage.removeItem("oauth_state");
  sessionStorage.removeItem("oauth_provider");

  return {
    code,
    provider: provider as "gmail" | "office365",
  };
}
