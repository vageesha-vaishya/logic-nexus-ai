import { getCorsHeaders } from "../_shared/cors.ts";
import { serveWithLogger, Logger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";

// @ts-ignore
declare const Deno: any;

// --- Interfaces ---

interface DomainIdentityResult {
  dkim_tokens: string[];
  identity_arn?: string;
  provider_metadata?: any;
}

interface EmailServiceProvider {
  name: string;
  createDomainIdentity(domain: string, logger: Logger): Promise<DomainIdentityResult>;
  // deleteDomainIdentity(domain: string, logger: Logger): Promise<void>; // Future use
}

// --- Providers ---

class MockEmailProvider implements EmailServiceProvider {
  name = 'mock-aws-ses';

  async createDomainIdentity(domain: string, logger: Logger): Promise<DomainIdentityResult> {
    logger.info(`[MockProvider] Creating identity for ${domain}...`);
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate pseudo-random tokens similar to AWS SES
    const base = domain.split('.')[0].substring(0, 10);
    const timestamp = Date.now().toString(36);
    return {
      dkim_tokens: [
        `${base}1${timestamp}`,
        `${base}2${timestamp}`,
        `${base}3${timestamp}`
      ],
      identity_arn: `arn:aws:ses:us-east-1:123456789012:identity/${domain}`,
      provider_metadata: {
        mock_generated_at: new Date().toISOString()
      }
    };
  }
}

class SendGridEmailProvider implements EmailServiceProvider {
  name = 'sendgrid';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createDomainIdentity(domain: string, logger: Logger): Promise<DomainIdentityResult> {
    logger.info(`[SendGridProvider] Creating identity for ${domain}...`);
    
    const response = await fetch('https://api.sendgrid.com/v3/whitelabel/domains', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        domain: domain,
        subdomain: 'em', // Common default
        automatic_security: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // SendGrid returns CNAME records directly. 
    // We need to extract the "values" or "host" parts that correspond to DKIM tokens if they use CNAME-based DKIM.
    // SendGrid's "automatic security" usually gives 3 CNAMEs for DKIM/SPF.
    // For this abstraction, we'll map the host prefixes or values as needed.
    // Note: SendGrid structure is different from AWS SES tokens. 
    // AWS SES gives tokens `abc`, `def`, `ghi` -> `abc._domainkey.example.com`.
    // SendGrid gives full CNAMEs like `em.example.com`, `s1._domainkey.example.com`.
    
    // We'll extract the selector parts if possible, or just store the full records in metadata.
    // For the `dkim_tokens` array expected by our schema (which assumes AWS-style selectors often),
    // we might need to adapt. 
    // However, our verify logic checks `${token}._domainkey.${domainName}`.
    // If SendGrid uses `s1`, `s2` selectors, we extract those.

    const dkim_tokens: string[] = [];
    if (data.dns) {
        // Extract selectors from SendGrid DNS records
        // keys usually: "mail_cname", "dkim1", "dkim2"
        if (data.dns.dkim1 && data.dns.dkim1.host) {
             // host might be "s1._domainkey.example.com" -> extract "s1"
             dkim_tokens.push(data.dns.dkim1.host.split('.')[0]);
        }
        if (data.dns.dkim2 && data.dns.dkim2.host) {
             dkim_tokens.push(data.dns.dkim2.host.split('.')[0]);
        }
    }

    return {
      dkim_tokens,
      provider_metadata: data
    };
  }
}

// @ts-ignore
import { SESClient, VerifyDomainDkimCommand } from "npm:@aws-sdk/client-ses";

class AwsSesEmailProvider implements EmailServiceProvider {
  name = 'aws-ses';
  private accessKeyId: string;
  private secretAccessKey: string;
  private region: string;

  constructor(accessKeyId: string, secretAccessKey: string, region: string) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region;
  }

  async createDomainIdentity(domain: string, logger: Logger): Promise<DomainIdentityResult> {
    logger.info(`[AwsSesProvider] Creating identity for ${domain}...`);
    
    try {
        const ses = new SESClient({
            region: this.region,
            credentials: {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey,
            },
        });

        const command = new VerifyDomainDkimCommand({ Domain: domain });

        const response = await ses.send(command);
        
        const dkimTokens = response.DkimTokens || [];
        const identityArn = `arn:aws:ses:${this.region}:identity/${domain}`;

        return {
          dkim_tokens: dkimTokens,
          identity_arn: identityArn,
          provider_metadata: {
            provider: 'aws_ses',
            identity_type: 'DOMAIN',
            dkim_tokens: dkimTokens,
            registered_at: new Date().toISOString()
          }
        };
    } catch (e) {
        logger.error("AWS SES Error:", { error: e });
        throw e;
    }
  }
}

// --- Factory ---

function getEmailProvider(): EmailServiceProvider {
  const providerType = Deno.env.get("EMAIL_PROVIDER_TYPE") || "mock"; // 'mock', 'sendgrid', 'aws-ses'
  
  if (providerType === 'sendgrid') {
    const apiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");
    return new SendGridEmailProvider(apiKey);
  }
  
  if (providerType === 'aws-ses') {
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const region = Deno.env.get("AWS_REGION") || "us-east-1";
    if (!accessKeyId || !secretAccessKey) throw new Error("Missing AWS credentials");
    return new AwsSesEmailProvider(accessKeyId, secretAccessKey, region);
  }

  return new MockEmailProvider();
}

// --- Main Handler ---

serveWithLogger(async (req, logger, _adminSupabase) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    // 1. Auth Check
    const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } 
      });
    }

    // 2. Parse Input
    const { domain_id, action = 'verify' } = await req.json();

    if (!domain_id) {
      throw new Error("Missing domain_id");
    }

    // 3. Fetch domain info
    // Use user-scoped client to ensure RLS
    const { data: domain, error: fetchError } = await supabaseClient
      .from("tenant_domains")
      .select("*")
      .eq("id", domain_id)
      .single();

    if (fetchError || !domain) {
      throw new Error("Domain not found or access denied");
    }

    const domainName = domain.domain_name;
    const updates: any = {
      updated_at: new Date().toISOString(),
      provider_metadata: domain.provider_metadata || {},
    };
    
    // --- Configuration Step (Auto-generate tokens if missing) ---
    // If we don't have DKIM tokens yet, ask the provider for them
    let dkimTokens = updates.provider_metadata.dkim_tokens;
    
    if (!dkimTokens || !Array.isArray(dkimTokens) || dkimTokens.length === 0) {
        logger.info(`Configuring identity for ${domainName}...`);
        try {
            const provider = getEmailProvider();
            const identity = await provider.createDomainIdentity(domainName, logger);
            
            dkimTokens = identity.dkim_tokens;
            
            // Update metadata
            updates.provider_metadata.dkim_tokens = dkimTokens;
            updates.provider_metadata.provider = provider.name;
            if (identity.identity_arn) {
                updates.provider_metadata.identity_arn = identity.identity_arn;
            }
            if (identity.provider_metadata) {
                updates.provider_metadata = { 
                    ...updates.provider_metadata, 
                    ...identity.provider_metadata 
                };
            }
        } catch (e) {
            logger.error("Failed to configure domain identity:", { error: e });
            // Don't fail the whole request, just proceed with what we have
        }
    }

    const verificationResults = {
        spf: false,
        dmarc: false,
        dkim: false
    };

    // 4. Verify SPF
    // Look for TXT record starting with "v=spf1"
    try {
      const txtRecords = await Deno.resolveDns(domainName, "TXT");
      const spfRecord = txtRecords.flat().find((r: string) => r.startsWith("v=spf1"));
      
      if (spfRecord) {
        verificationResults.spf = true;
        updates.spf_record = spfRecord;
        updates.spf_verified = true; 
      } else {
        updates.spf_verified = false;
      }
    } catch (e) {
      logger.error("SPF check failed (DNS lookup)", { error: e });
      updates.spf_verified = false;
    }

    // 5. Verify DMARC
    // Look for TXT record at _dmarc.domainName
    try {
      const dmarcRecords = await Deno.resolveDns(`_dmarc.${domainName}`, "TXT");
      const dmarcRecord = dmarcRecords.flat().find((r: string) => r.startsWith("v=DMARC1"));
      if (dmarcRecord) {
        verificationResults.dmarc = true;
        updates.dmarc_record = dmarcRecord;
        updates.dmarc_verified = true;
      } else {
        updates.dmarc_verified = false;
      }
    } catch (e) {
      logger.error("DMARC check failed (DNS lookup)", { error: e });
      updates.dmarc_verified = false;
    }

    // 6. Verify DKIM
    // Check CNAMEs for each token
    if (dkimTokens && dkimTokens.length > 0) {
      let dkimVerifiedCount = 0;
      for (const token of dkimTokens) {
        try {
            // Standard DKIM CNAME: {token}._domainkey.{domain}
            const recordName = `${token}._domainkey.${domainName}`;
            const cnameRecords = await Deno.resolveDns(recordName, "CNAME");
            
            if (cnameRecords && cnameRecords.length > 0) {
                dkimVerifiedCount++;
            }
        } catch (e) {
            // Ignore DNS errors for individual tokens
        }
      }

      // If we found at least one valid record, we consider it partially verified
      // Ideally all should match
      if (dkimVerifiedCount >= 1) { // Relaxed check
        verificationResults.dkim = true;
        updates.dkim_verified = true;
      } else {
        updates.dkim_verified = false;
      }
    }

    updates.status = (updates.spf_verified && updates.dkim_verified) ? 'active' : 'pending_verification';

    // 7. Update Database
    const { error: updateError } = await supabaseClient
      .from("tenant_domains")
      .update(updates)
      .eq("id", domain_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ 
        success: true, 
        domain: domainName,
        verification: verificationResults,
        updates 
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logger.error("Error in domains-verify:", { error: error });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
}, "domains-verify");
