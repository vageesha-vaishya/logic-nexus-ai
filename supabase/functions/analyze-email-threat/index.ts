
import { getCorsHeaders } from "../_shared/cors.ts";
import { serveWithLogger, Logger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";
import { callLLM, LlmCallContext } from "../_shared/llm-gateway.ts";

serveWithLogger(async (req, logger, supabaseAdmin) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    // 1. Auth Check
    const { user, supabaseClient, error: authError } = await requireAuth(req, logger);

    if (authError || !user) {
        logger.error("Auth error:", { error: authError });
        throw new Error("Unauthorized: Invalid token");
    }

    // 3. Parse Input
    const { email_id, content } = await req.json();

    let emailSubject = "";
    let emailBody = "";
    let emailSender = "";
    let tenantId = "";

    // 4. Fetch Email Content if email_id provided
    if (email_id) {
        const { data: email, error: fetchError } = await supabaseClient
            .from("emails")
            .select("subject, body, account_id, tenant_id")
            .eq("id", email_id)
            .single();

        if (fetchError || !email) {
            throw new Error("Email not found");
        }

        emailSubject = email.subject || "";
        emailBody = email.body || ""; // Assumes plain text body or simple HTML
        tenantId = email.tenant_id;

        // Fetch sender from account? No, we need the FROM address of the email itself.
        // Assuming 'raw_headers' or similar has it, or we parse it from body/headers if stored.
        // For Phase 2, we'll assume the body/subject is enough for content analysis.
    } else if (content) {
        emailSubject = content.subject || "";
        emailBody = content.body || "";
        emailSender = content.sender || "";
    } else {
        throw new Error("Must provide either email_id or content");
    }

    // Resolve tenant if the email row didn't carry one (e.g. the content-only
    // path). Needed by the LLM gateway to pick a per-tenant provider config,
    // or fall through to the self-hosted rig.
    if (!tenantId) {
        const { data: roleRows, error: roleError } = await supabaseAdmin
            .from('user_roles')
            .select('tenant_id')
            .eq('user_id', user.id)
            .not('tenant_id', 'is', null)
            .limit(1);
        tenantId = roleRows?.[0]?.tenant_id ?? "";
        if (!tenantId) {
            logger.error("Caller has no tenant assignment", { userId: user.id, error: roleError?.message });
            throw new Error("No tenant assignment for this user");
        }
    }

    // 5. Analyze via the shared LLM Gateway (routes to tenant-configured
    //    provider, or falls through to the self-hosted vLLM rig — see
    //    _shared/llm-gateway.ts).
    const ctx: LlmCallContext = { tenantId, userId: user.id, supabaseAdmin, logger };
    const llmResult = await callLLM("security.email_threat", {
        subject: emailSubject,
        sender: emailSender,
        body: emailBody.substring(0, 3000),
    }, ctx);

    let analysisResult: any;
    try {
        analysisResult = JSON.parse(llmResult.text);
    } catch (_err) {
        // Defensive: unlike the previous OpenAI-only call, the gateway may
        // route to providers with no native "JSON mode" (response_format is
        // enforced via the system prompt instead — see llm-gateway.ts). Strip
        // an accidental markdown code fence before giving up.
        const stripped = llmResult.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
        analysisResult = JSON.parse(stripped);
    }

    return await handleResult(supabaseClient, email_id, tenantId, analysisResult, req, user.id);

  } catch (error: any) {
    logger.error("Error:", { error });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
}, "analyze-email-threat");

async function handleResult(supabase: any, emailId: string | undefined, tenantId: string, result: any, req: Request, userId: string) {
    // 6. Update DB if email_id provided
    if (emailId) {
        // Update email record
        await supabase.from("emails").update({
            threat_level: result.threat_level,
            threat_score: result.threat_score,
            threat_details: result
        }).eq("id", emailId);

        // Create Incident if suspicious/malicious
        if (result.threat_level !== 'safe') {
            await supabase.from("security_incidents").insert({
                tenant_id: tenantId,
                email_id: emailId,
                threat_level: result.threat_level,
                threat_type: result.threat_type,
                description: result.reasoning,
                ai_analysis: result,
                status: 'open'
            });
        }
    }

    return new Response(
        JSON.stringify({ success: true, analysis: result }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
}
