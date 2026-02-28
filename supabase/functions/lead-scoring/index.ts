import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

type LeadScoreRequest = {
  lead_id: string;
};

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    const { user, error: authError, supabaseClient: supabase } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let payload: LeadScoreRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (!payload?.lead_id) {
      return new Response(JSON.stringify({ error: "Missing lead_id" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Fetch lead attributes
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, industry, estimated_value, created_at, last_contacted_at, engagement_score")
      .eq("id", payload.lead_id)
      .maybeSingle();
    if (leadErr || !lead) throw leadErr || new Error("Lead not found");

    // Heuristic logistic-like scoring
    const features: Record<string, number> = {};
    const reasons: string[] = [];

    const daysSinceCreation = Math.max(0, Math.round((Date.now() - new Date(lead.created_at).getTime()) / (1000*60*60*24)));
    const daysSinceContact = lead.last_contacted_at ? Math.max(0, Math.round((Date.now() - new Date(lead.last_contacted_at).getTime()) / (1000*60*60*24))) : 999;
    const value = Number(lead.estimated_value ?? 0);
    const engagement = Number(lead.engagement_score ?? 0);

    features.days_since_creation = daysSinceCreation;
    features.days_since_contact = daysSinceContact;
    features.estimated_value = value;
    features.engagement_score = engagement;
    features.industry_match = ["retail","electronics","apparel","automotive"].includes(String(lead.industry||"").toLowerCase()) ? 1 : 0;

    // Weights (toy model)
    const w = {
      intercept: -1.0,
      days_since_creation: -0.02,
      days_since_contact: -0.03,
      estimated_value: 0.00002,
      engagement_score: 0.05,
      industry_match: 0.5,
    };
    const z = w.intercept
      + w.days_since_creation * features.days_since_creation
      + w.days_since_contact * features.days_since_contact
      + w.estimated_value * features.estimated_value
      + w.engagement_score * features.engagement_score
      + w.industry_match * features.industry_match;
    const prob = 1 / (1 + Math.exp(-z));
    const score = Math.round(prob * 100);

    if (features.industry_match) reasons.push("Industry match");
    if (value > 100000) reasons.push("High estimated value");
    if (engagement > 10) reasons.push("High engagement");
    if (daysSinceContact > 7) reasons.push("Stale contact");

    const factors = { features, reasons, probability: prob };
    const { error: updErr } = await supabase
      .from("leads")
      .update({ ai_score: score, ai_score_factors: factors })
      .eq("id", payload.lead_id);
    if (updErr) throw updErr;

    await logAiCall(supabase, {
      user_id: user.id,
      function_name: "lead-scoring",
      model_used: "logit-heuristic-v1",
      output_summary: { ai_score: score },
      pii_detected: false,
      pii_fields_redacted: [],
    });

    return new Response(JSON.stringify({ lead_id: payload.lead_id, ai_score: score, ai_score_factors: factors }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    logger.error("Error in lead-scoring", { error: e });
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}, "lead-scoring");
