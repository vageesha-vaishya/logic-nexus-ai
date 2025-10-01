import { supabase } from "@/integrations/supabase/client";

interface OAuthConfig {
  client_id: string;
  client_secret: string;
  tenant_id_provider?: string;
  redirect_uri: string;
}

export async function initiateGoogleOAuth(userId: string) {
  try {
    // Fetch OAuth configuration
    const { data: config, error } = await supabase
      .from("oauth_configurations" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .eq("is_active", true)
      .single();

    if (error || !config) {
      throw new Error("Gmail OAuth not configured. Please configure OAuth settings first.");
    }

    const oauthConfig = config as any as OAuthConfig;

    // Generate state parameter for security
    const state = crypto.randomUUID();
    sessionStorage.setItem("oauth_state", state);
    sessionStorage.setItem("oauth_provider", "gmail");

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: oauthConfig.client_id,
      redirect_uri: oauthConfig.redirect_uri,
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
    // Fetch OAuth configuration
    const { data: config, error } = await supabase
      .from("oauth_configurations" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "office365")
      .eq("is_active", true)
      .single();

    if (error || !config) {
      throw new Error("Office 365 OAuth not configured. Please configure OAuth settings first.");
    }

    const oauthConfig = config as any as OAuthConfig;

    // Generate state parameter for security
    const state = crypto.randomUUID();
    sessionStorage.setItem("oauth_state", state);
    sessionStorage.setItem("oauth_provider", "office365");

    // Build Microsoft OAuth URL
    const params = new URLSearchParams({
      client_id: oauthConfig.client_id,
      redirect_uri: oauthConfig.redirect_uri,
      response_type: "code",
      scope: [
        "https://outlook.office.com/Mail.Read",
        "https://outlook.office.com/Mail.Send",
        "https://outlook.office.com/Mail.ReadWrite",
        "offline_access",
        "openid",
        "profile",
        "email",
      ].join(" "),
      prompt: "consent",
      state,
    });

    const tenantId = oauthConfig.tenant_id_provider || "common";
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
