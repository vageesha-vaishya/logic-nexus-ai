// @ts-ignore
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

// @ts-ignore
declare const Deno: any;

console.log("Hello from email-scan!");

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const host = (() => {
      try { return new URL(req.url).host; } catch { return ""; }
    })();
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? (host ? `https://${host}` : ""));
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? (req.headers.get("apikey") ?? "");
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1. Initialize Supabase Client (prefer Service Role; fallback to user-scoped)
    const supabaseClient = serviceKey
      ? createClient(supabaseUrl, serviceKey)
      : createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

    // 2. Parse Input
    const { email_id } = await req.json();

    if (!email_id) {
      throw new Error("Missing email_id");
    }

    // 3. Fetch Email Content
    // We select basic fields. In a real scenario, we'd fetch attachments from Storage too.
    const { data: email, error: fetchError } = await supabaseClient
      .from("emails")
      .select("id, subject, body_text, body_html, security_status")
      .eq("id", email_id)
      .single();

    if (fetchError || !email) {
      throw new Error("Email not found");
    }

    // 4. Mock Scan Logic (Simulate VirusTotal / GuardDuty)
    console.log(`Scanning email ${email_id}: ${email.subject}`);
    
    // Simple heuristics for demo
    const suspiciousKeywords = ['lottery', 'winner', 'wire transfer', 'urgent request', 'verify your account', 'bank', 'password'];
    const maliciousKeywords = ['virus', 'malware', 'exploit', 'trojan', 'ransomware', 'executable'];
    
    let status = 'clean';
    let score = 0;
    const reasons: string[] = [];

    const content = (email.subject + " " + (email.body_text || "")).toLowerCase();

    // Check malicious
    for (const kw of maliciousKeywords) {
        if (content.includes(kw)) {
            status = 'malicious';
            score += 50;
            reasons.push(`Detected malicious keyword: ${kw}`);
        }
    }

    // Check suspicious if not already malicious
    if (status !== 'malicious') {
        for (const kw of suspiciousKeywords) {
            if (content.includes(kw)) {
                status = 'suspicious';
                score += 20;
                reasons.push(`Detected suspicious keyword: ${kw}`);
            }
        }
    }
    
    // Simulate external API latency
    await new Promise(resolve => setTimeout(resolve, 300));

    // 5. Update Email Status
    const updates: any = {
        security_status: status,
        scanned_at: new Date().toISOString(),
        quarantine_reason: reasons.length > 0 ? reasons.join('; ') : null,
        security_metadata: {
            scanner: 'mock-virustotal',
            score: score,
            details: reasons,
            scan_id: crypto.randomUUID(),
            provider_response: {
                positives: reasons.length,
                total: 60, // Mock VirusTotal total engines
                permalink: `https://www.virustotal.com/gui/file/${crypto.randomUUID()}/detection`
            }
        }
    };

    // Auto-quarantine malicious emails
    if (status === 'malicious') {
        updates.folder = 'quarantine';
    }

    const { error: updateError } = await supabaseClient
      .from("emails")
      .update(updates)
      .eq("id", email_id);

    if (updateError) {
        throw new Error("Failed to update email security status: " + updateError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_id: email_id,
        scan_result: updates
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
