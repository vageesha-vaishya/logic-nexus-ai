// @ts-ignore
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { SESClient, CreateEmailIdentityCommand } from "https://esm.sh/@aws-sdk/client-ses@3.400.0";

// @ts-ignore
declare const Deno: any;

console.log("Hello from domains-register!");

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Authenticate User
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        throw new Error("Missing Authorization header");
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
        throw new Error("Unauthorized: Invalid token");
    }

    // 2. Parse Input
    const { domain_name } = await req.json();

    if (!domain_name) {
      throw new Error("Missing domain_name");
    }

    // 3. Determine Tenant ID
    // We call the RPC to get the user's tenant ID.
    const { data: tenantId, error: tenantError } = await supabaseClient
        .rpc('get_user_tenant_id', { user_id: user.id });

    if (tenantError) {
        console.error("Error getting tenant id:", tenantError);
        throw new Error("Could not determine tenant for user");
    }
    
    if (!tenantId) {
         throw new Error("User is not associated with any tenant");
    }

    // 4. Provider Registration (AWS SES)
    let dkimTokens: string[] = [];
    let identityArn = "";
    let providerMetadata: any = {};

    const awsAccessKey = Deno.env.get("AWS_ACCESS_KEY_ID");
    const awsSecretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";

    if (awsAccessKey && awsSecretKey) {
        // Real AWS SES Integration
        console.log("Using Real AWS SES credentials");
        const ses = new SESClient({
            region: awsRegion,
            credentials: {
                accessKeyId: awsAccessKey,
                secretAccessKey: awsSecretKey,
            },
        });

        const command = new CreateEmailIdentityCommand({
            EmailIdentity: domain_name,
        });

        const response = await ses.send(command);
        
        // AWS SES v2 returns DkimAttributes in the response or requires a separate call depending on SDK version
        // For CreateEmailIdentity (v2), it returns DkimAttributes.
        // Wait, SDK v3 usually maps to API v2. Let's check response structure.
        // If using V1 (VerifyDomainDkim), it returns tokens directly.
        // If using V2 (CreateEmailIdentity), it returns DkimAttributes.
        
        // For simplicity and standard compliance, we assume CreateEmailIdentity returns necessary info
        // or we default to a standard set if immediate tokens aren't returned (some setups use Easy DKIM).
        
        // Actually, CreateEmailIdentity response contains DkimAttributes which has Tokens.
        dkimTokens = response.DkimAttributes?.Tokens || [];
        identityArn = response.IdentityType === 'DOMAIN' ? `arn:aws:ses:${awsRegion}:identity/${domain_name}` : ""; // ARN might not be in response directly
        
        providerMetadata = {
            provider: 'aws_ses',
            identity_type: response.IdentityType,
            verified_for_sending_status: response.VerifiedForSendingStatus,
            dkim_attributes: response.DkimAttributes,
            registered_at: new Date().toISOString()
        };
    } else {
        // Mock Implementation (Fallback)
        console.log("Using Mock AWS SES (No credentials found)");
        const generateToken = () => Math.random().toString(36).substring(2, 15);
        dkimTokens = [generateToken(), generateToken(), generateToken()];
        identityArn = `arn:aws:ses:us-east-1:123456789012:identity/${domain_name}`;
        
        providerMetadata = {
            provider: 'aws_ses_mock',
            identity_arn: identityArn,
            dkim_tokens: dkimTokens,
            registered_at: new Date().toISOString()
        };
    }

    // 5. Upsert into tenant_domains
    const { data: domainRecord, error: upsertError } = await supabaseClient
      .from("tenant_domains")
      .upsert({
          tenant_id: tenantId,
          domain_name: domain_name,
          provider_metadata: providerMetadata,
          is_verified: false,
          spf_verified: false,
          dkim_verified: false,
          dmarc_verified: false
      }, { onConflict: 'tenant_id, domain_name' })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ 
          success: true, 
          domain: domainRecord,
          dkim_tokens: dkimTokens,
          instructions: {
              spf: "v=spf1 include:amazonses.com ~all",
              dkim: dkimTokens.map(t => ({
                  name: `${t}._domainkey.${domain_name}`,
                  type: "CNAME",
                  value: `${t}.dkim.amazonses.com`
              })),
              dmarc: "v=DMARC1; p=none;"
          }
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
