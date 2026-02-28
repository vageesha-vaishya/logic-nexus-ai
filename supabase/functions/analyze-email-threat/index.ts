
import { getCorsHeaders } from "../_shared/cors.ts";
import { serveWithLogger, Logger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";

serveWithLogger(async (req, logger, _adminSupabase) => {
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

    // 5. Call OpenAI for Analysis
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) {
        // Fallback for dev/test without key: Simulate analysis
        logger.warn("Missing OPENAI_API_KEY. Using simulation mode.");
        const isPhishing = emailSubject.toLowerCase().includes("urgent") || emailBody.toLowerCase().includes("wire transfer");
        
        const simulatedResult = {
            threat_level: isPhishing ? "suspicious" : "safe",
            threat_score: isPhishing ? 0.75 : 0.1,
            threat_type: isPhishing ? "BEC" : "None",
            reasoning: isPhishing ? "Detected urgency and financial keywords." : "No threats detected.",
            analysis_timestamp: new Date().toISOString()
        };
        
        return await handleResult(supabaseClient, email_id, tenantId, simulatedResult, req, user.id);
    }

    const systemPrompt = `You are an expert Cyber Security AI specializing in Email Security.
    Analyze the provided email for:
    1. Phishing attempts
    2. Business Email Compromise (BEC) - e.g., urgent wire transfers, CEO fraud
    3. Malicious intent or social engineering
    
    Output JSON only:
    {
        "threat_level": "safe" | "suspicious" | "malicious",
        "threat_score": float (0.0 to 1.0),
        "threat_type": "Phishing" | "BEC" | "Malware" | "Spam" | "None",
        "reasoning": "Brief explanation"
    }
    `;

    const userMessage = `
    Subject: ${emailSubject}
    Sender: ${emailSender}
    Body:
    ${emailBody.substring(0, 3000)} -- truncated
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${openAiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            response_format: { type: "json_object" }
        })
    });

    const aiData = await response.json();
    
    if (!aiData.choices || !aiData.choices[0].message.content) {
        throw new Error("Invalid response from OpenAI");
    }

    const analysisResult = JSON.parse(aiData.choices[0].message.content);
    
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
